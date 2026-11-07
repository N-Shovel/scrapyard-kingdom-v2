import config from './config.js'
import MinHeap from './MinHeap.js'
import seededRandom from './seededRandom.js'

export const EMPTY = 0
export const JUNK = 1
export const STASH = 2

const DIAGONAL = 1.4142
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
// Which way a footprint grows for each quarter turn, clockwise on the map with north (-j) up: +j, -i, -j, +i
const TURNS = [[0, 1], [-1, 0], [0, -1], [1, 0]]

// The map as data: terrain, gates, structures, collision and enemy pathfinding.
// No three.js in here, so `npm test` can run it. Positions are anything with x and z.
export default class Grid
{
    constructor()
    {
        this.size = config.GRID
        this.cell = config.CELL
        this.half = (this.size * this.cell) / 2

        this.terrain = new Uint8Array(this.size * this.size)
        this.structures = new Array(this.size * this.size).fill(null)
        this.reserved = new Set() // gate cells and the ones right behind them, nothing can be built there
        this.gates = []
        this.stashCells = []
        this.version = 0

        this.setGates()
    }

    // ---------- coordinates ----------

    index(i, j)
    {
        return j * this.size + i
    }

    inBounds(i, j)
    {
        return i >= 0 && j >= 0 && i < this.size && j < this.size
    }

    cellToWorld(i, j)
    {
        return { x: (i + 0.5) * this.cell - this.half, z: (j + 0.5) * this.cell - this.half }
    }

    worldToCell(x, z)
    {
        return { i: Math.floor((x + this.half) / this.cell), j: Math.floor((z + this.half) / this.cell) }
    }

    // ---------- what stands where ----------

    walkable(i, j)
    {
        if(!this.inBounds(i, j))
            return false

        const k = this.index(i, j)
        if(this.terrain[k] !== EMPTY)
            return false

        const structure = this.structures[k]
        return !(structure && structure.def.blocks)
    }

    solid(i, j)
    {
        return !this.walkable(i, j)
    }

    // The cells a structure would cover. rotation counts quarter turns clockwise. A car grows from the
    // anchor, so turning swings it around the anchor cell. A container stays centered on it.
    footprint(type, i, j, rotation = 0)
    {
        const [di, dj] = TURNS[rotation % 4]
        const cells = []
        const length = config.STRUCTURES[type].cells
        const start = -Math.floor((length - 1) / 2)
        for(let n = start; n < start + length; n++)
            cells.push({ i: i + di * n, j: j + dj * n })
        return cells
    }

    canPlace(cells)
    {
        return cells.every(({ i, j }) =>
        {
            if(!this.inBounds(i, j))
                return false
            const k = this.index(i, j)
            return this.terrain[k] === EMPTY && !this.structures[k] && !this.reserved.has(k)
        })
    }

    // structure needs { def, cells }. Grid does not care what else it holds.
    place(structure)
    {
        for(const { i, j } of structure.cells)
            this.structures[this.index(i, j)] = structure
        this.recompute()
    }

    remove(structure)
    {
        for(const { i, j } of structure.cells)
            this.structures[this.index(i, j)] = null
        this.recompute()
    }

    // ---------- collision ----------

    // Pushes a circle out of solid cells.
    resolveCircle(position, radius)
    {
        const center = this.worldToCell(position.x, position.z)
        const halfCell = this.cell / 2

        for(let dj = -1; dj <= 1; dj++)
        {
            for(let di = -1; di <= 1; di++)
            {
                const ci = center.i + di
                const cj = center.j + dj
                if(!this.solid(ci, cj))
                    continue

                const cx = (ci + 0.5) * this.cell - this.half
                const cz = (cj + 0.5) * this.cell - this.half
                const nearX = Math.max(cx - halfCell, Math.min(cx + halfCell, position.x))
                const nearZ = Math.max(cz - halfCell, Math.min(cz + halfCell, position.z))
                const dx = position.x - nearX
                const dz = position.z - nearZ
                const squared = dx * dx + dz * dz
                if(squared >= radius * radius)
                    continue

                if(squared > 1e-8)
                {
                    const distance = Math.sqrt(squared)
                    position.x += (dx / distance) * (radius - distance)
                    position.z += (dz / distance) * (radius - distance)
                }
                else
                {
                    // Center inside the box: leave along the shallowest axis
                    const pushX = halfCell - Math.abs(position.x - cx) + radius
                    const pushZ = halfCell - Math.abs(position.z - cz) + radius
                    if(pushX < pushZ)
                        position.x += Math.sign(position.x - cx || 1) * pushX
                    else
                        position.z += Math.sign(position.z - cz || 1) * pushZ
                }
            }
        }
    }

    // Distance from a point to the nearest of these cells, 0 inside one. For the Stash and long structures.
    distanceToCells(x, z, cells)
    {
        const half = this.cell / 2
        let best = Infinity
        for(const { i, j } of cells)
        {
            const center = this.cellToWorld(i, j)
            const dx = Math.max(Math.abs(x - center.x) - half, 0)
            const dz = Math.max(Math.abs(z - center.z) - half, 0)
            best = Math.min(best, Math.hypot(dx, dz))
        }
        return best
    }

    // Straight-line visibility across the grid.
    lineClear(ax, az, bx, bz)
    {
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5)
        for(let step = 1; step < steps; step++)
        {
            const t = step / steps
            const { i, j } = this.worldToCell(ax + (bx - ax) * t, az + (bz - az) * t)
            if(this.solid(i, j))
                return false
        }
        return true
    }

    // How many obstacles lie between two points, not counting the end cells. A long structure counts once.
    obstaclesBetween(ax, az, bx, bz, max)
    {
        const a = this.worldToCell(ax, az)
        const b = this.worldToCell(bx, bz)
        const startKey = this.index(a.i, a.j)
        const endKey = this.index(b.i, b.j)
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3)
        const seen = new Set()

        for(let step = 1; step < steps; step++)
        {
            const t = step / steps
            const { i, j } = this.worldToCell(ax + (bx - ax) * t, az + (bz - az) * t)
            if(!this.inBounds(i, j) || !this.solid(i, j))
                continue

            const k = this.index(i, j)
            if(k === startKey || k === endKey)
                continue

            seen.add(this.structures[k] ?? k)
            if(seen.size > max)
                break
        }
        return seen.size
    }

    // ---------- pathfinding ----------

    enterCost(k, wallCost)
    {
        const structure = this.structures[k]
        return structure && structure.def.blocks ? 1 + (wallCost * structure.def.hp) / 100 : 1
    }

    // Dijkstra from the Stash outward: dist[cell] is what it costs an enemy there to reach the Stash.
    // Walls can be crossed at a price, so sealing every route makes enemies break the cheapest wall.
    computeFlow(wallCost)
    {
        // Float64 on purpose: Float32 rounding against the heap's doubles can re-queue nodes forever
        const dist = new Float64Array(this.size * this.size).fill(Infinity)
        const heap = new MinHeap()

        for(const { i, j } of this.stashCells)
        {
            dist[this.index(i, j)] = 0
            heap.push(this.index(i, j), 0)
        }

        while(heap.size)
        {
            const k = heap.pop()
            const distance = heap.lastPriority
            if(distance > dist[k])
                continue

            const i = k % this.size
            const j = (k / this.size) | 0
            const structure = this.structures[k]
            const blocked = !!(structure && structure.def.blocks)
            const cost = this.enterCost(k, wallCost)

            for(const [di, dj] of DIRECTIONS)
            {
                const ni = i + di
                const nj = j + dj
                if(!this.inBounds(ni, nj))
                    continue

                const nk = this.index(ni, nj)
                if(this.terrain[nk] !== EMPTY)
                    continue

                const diagonal = di !== 0 && dj !== 0
                if(diagonal)
                {
                    if(blocked) // walls are only attacked head-on
                        continue
                    if(!this.walkable(i, nj) || !this.walkable(ni, j)) // no cutting corners
                        continue
                }

                const next = distance + cost * (diagonal ? DIAGONAL : 1)
                if(next < dist[nk])
                {
                    dist[nk] = next
                    heap.push(nk, next)
                }
            }
        }
        return dist
    }

    recompute()
    {
        this.flowNormal = { dist: this.computeFlow(config.WALL_COST_NORMAL), wallCost: config.WALL_COST_NORMAL }
        this.flowBrute = { dist: this.computeFlow(config.WALL_COST_BRUTE), wallCost: config.WALL_COST_BRUTE }
        this.version++
    }

    // Best neighbour to step into. Counts the price of breaking in, so one lone wall gets walked around.
    nextCell(i, j, flow)
    {
        if(!this.inBounds(i, j))
            return null

        let best = null
        let bestValue = Infinity

        for(const [di, dj] of DIRECTIONS)
        {
            const ni = i + di
            const nj = j + dj
            if(!this.inBounds(ni, nj))
                continue

            const nk = this.index(ni, nj)
            if(this.terrain[nk] === JUNK)
                continue

            const diagonal = di !== 0 && dj !== 0
            if(diagonal)
            {
                if(!this.walkable(i + di, j) || !this.walkable(i, j + dj))
                    continue
                if(!this.walkable(ni, nj) && this.terrain[nk] !== STASH)
                    continue
            }

            const value = flow.dist[nk] + this.enterCost(nk, flow.wallCost) * (diagonal ? DIAGONAL : 1)
            if(value < bestValue)
            {
                bestValue = value
                best = { i: ni, j: nj }
            }
        }
        return best
    }

    // Follows a flow field from a gate to the Stash. breach is the first wall on the way, or null.
    traceRoute(gate, flow)
    {
        let { i, j } = gate.cells[1]
        const cells = [{ i, j }]
        let breach = null

        for(let n = 0; n < 400; n++)
        {
            const next = this.nextCell(i, j, flow)
            if(!next)
                break

            const structure = this.structures[this.index(next.i, next.j)]
            if(structure && structure.def.blocks && !breach)
                breach = structure

            cells.push(next)
            i = next.i
            j = next.j
            if(this.terrain[this.index(i, j)] === STASH)
                break
        }
        return { cells, breach }
    }

    // Every gate's route, cached until the grid changes.
    updateRoutes()
    {
        if(this.routesVersion === this.version)
            return
        this.routesVersion = this.version

        for(const gate of this.gates)
        {
            const normal = this.traceRoute(gate, this.flowNormal)
            const brute = this.traceRoute(gate, this.flowBrute)
            gate.route = normal.cells
            gate.breach = normal.breach
            gate.bruteRoute = brute.cells
            gate.bruteBreach = brute.breach
        }
    }

    // Distance field toward one structure, for enemies locked onto it. Starts from all its cells.
    flowTo(structure)
    {
        if(this.towardVersion !== this.version)
        {
            this.towardVersion = this.version
            this.towardCache = new Map()
        }

        const cached = this.towardCache.get(structure)
        if(cached)
            return cached

        const dist = new Float64Array(this.size * this.size).fill(Infinity)
        const heap = new MinHeap()
        const own = new Set(structure.cells.map(({ i, j }) => this.index(i, j)))
        for(const k of own)
        {
            dist[k] = 0
            heap.push(k, 0)
        }

        while(heap.size)
        {
            const k = heap.pop()
            const distance = heap.lastPriority
            if(distance > dist[k])
                continue

            const i = k % this.size
            const j = (k / this.size) | 0
            for(const [di, dj] of DIRECTIONS)
            {
                const diagonal = di !== 0 && dj !== 0
                if(own.has(k) && diagonal) // walls are attacked head-on
                    continue

                const ni = i + di
                const nj = j + dj
                if(!this.walkable(ni, nj))
                    continue
                if(diagonal && (!this.walkable(i, nj) || !this.walkable(ni, j)))
                    continue

                const nk = this.index(ni, nj)
                const next = distance + (diagonal ? DIAGONAL : 1)
                if(next < dist[nk])
                {
                    dist[nk] = next
                    heap.push(nk, next)
                }
            }
        }

        this.towardCache.set(structure, dist)
        return dist
    }

    // Next step toward a structure. null if walking cannot reach it.
    nextCellTo(i, j, structure)
    {
        const dist = this.flowTo(structure)
        const own = new Set(structure.cells.map((cell) => this.index(cell.i, cell.j)))
        let best = null
        let bestValue = Infinity

        for(const [di, dj] of DIRECTIONS)
        {
            const ni = i + di
            const nj = j + dj
            if(!this.inBounds(ni, nj))
                continue

            const nk = this.index(ni, nj)
            const diagonal = di !== 0 && dj !== 0
            let value
            if(own.has(nk))
            {
                if(diagonal)
                    continue
                value = 1
            }
            else
            {
                if(!this.walkable(ni, nj))
                    continue
                if(diagonal && (!this.walkable(i + di, j) || !this.walkable(i, j + dj)))
                    continue
                value = dist[nk] + (diagonal ? DIAGONAL : 1)
            }

            if(value < bestValue)
            {
                bestValue = value
                best = { i: ni, j: nj }
            }
        }
        return Number.isFinite(bestValue) ? best : null
    }

    // ---------- map generation ----------

    setGates()
    {
        const n = this.size
        const m = n / 2
        const definitions = [
            { name: 'North', cells: [[m - 1, 0], [m, 0], [m + 1, 0]] },
            { name: 'South', cells: [[m - 2, n - 1], [m - 1, n - 1], [m, n - 1]] },
            { name: 'West', cells: [[0, m - 2], [0, m - 1], [0, m]] },
            { name: 'East', cells: [[n - 1, m - 1], [n - 1, m], [n - 1, m + 1]] },
            { name: 'North-East', cells: [[n - 9, 0], [n - 8, 0], [n - 7, 0]] },
            { name: 'South-West', cells: [[6, n - 1], [7, n - 1], [8, n - 1]] }
        ]

        this.gates = definitions.map(({ name, cells }) =>
        {
            const gateCells = cells.map(([i, j]) => ({ i, j }))
            const center = this.cellToWorld(gateCells[1].i, gateCells[1].j)
            return { name, cells: gateCells, center, route: [], bruteRoute: [], breach: null, bruteBreach: null, lock: null, bruteLock: null }
        })
    }

    // A new yard: fence, Stash in the middle, gates, and junk clusters that make lanes.
    generate(seed)
    {
        const random = seededRandom(seed)
        const n = this.size
        const m = n / 2
        const terrain = this.terrain
        terrain.fill(EMPTY)

        for(let j = 0; j < n; j++)
            for(let i = 0; i < n; i++)
                if(i === 0 || j === 0 || i === n - 1 || j === n - 1)
                    terrain[this.index(i, j)] = JUNK

        // A square in the middle, row by row from its north-west corner
        const side = config.STASH_CELLS / 2
        this.stashCells = []
        for(let j = m - side; j < m + side; j++)
            for(let i = m - side; i < m + side; i++)
                this.stashCells.push({ i, j })
        for(const { i, j } of this.stashCells)
            terrain[this.index(i, j)] = STASH

        this.reserved.clear()
        for(const gate of this.gates)
        {
            gate.lock = null
            gate.bruteLock = null
            for(const { i, j } of gate.cells)
            {
                terrain[this.index(i, j)] = EMPTY
                this.reserved.add(this.index(i, j))
                const insideI = i === 0 ? 1 : i === n - 1 ? n - 2 : i
                const insideJ = j === 0 ? 1 : j === n - 1 ? n - 2 : j
                this.reserved.add(this.index(insideI, insideJ))
            }
        }

        this.placeJunk(random)
        this.recompute()
    }

    placeJunk(random)
    {
        const n = this.size
        const m = n / 2
        const terrain = this.terrain
        const clusters = Math.round(56 * (n * n) / (40 * 40))
        let placed = 0

        for(let tries = 0; placed < clusters && tries < 700; tries++)
        {
            let ci = 2 + Math.floor(random() * (n - 4))
            let cj = 2 + Math.floor(random() * (n - 4))
            if(Math.hypot(ci - (m - 0.5), cj - (m - 0.5)) < 6.5)
                continue
            if(this.gates.some(({ cells }) => cells.some(({ i, j }) => Math.max(Math.abs(i - ci), Math.abs(j - cj)) < 4)))
                continue

            const added = []
            const length = 4 + Math.floor(random() * 7)
            for(let step = 0; step < length; step++)
            {
                // The walk may wander toward a gate, but never onto it or the cell inside it
                const k = this.inBounds(ci, cj) ? this.index(ci, cj) : -1
                if(k >= 0 && terrain[k] === EMPTY && !this.reserved.has(k) && Math.hypot(ci - (m - 0.5), cj - (m - 0.5)) >= 5)
                {
                    added.push(k)
                    terrain[k] = JUNK
                }
                const [di, dj] = DIRECTIONS[Math.floor(random() * 4)]
                ci += di
                cj += dj
            }

            // A cluster that seals off any open cell is taken back
            const flow = this.computeFlow(0)
            if(terrain.every((value, k) => value !== EMPTY || Number.isFinite(flow[k])))
                placed++
            else
                for(const k of added)
                    terrain[k] = EMPTY
        }
    }
}
