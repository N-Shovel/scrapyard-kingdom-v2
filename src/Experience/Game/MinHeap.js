// Priority queue for the flow fields. Keys and priorities sit in two arrays, so nothing is allocated per node.
export default class MinHeap
{
    constructor()
    {
        this.keys = []
        this.priorities = []
        this.lastPriority = 0
    }

    get size()
    {
        return this.keys.length
    }

    push(key, priority)
    {
        const { keys, priorities } = this
        keys.push(key)
        priorities.push(priority)

        let i = keys.length - 1
        while(i > 0)
        {
            const parent = (i - 1) >> 1
            if(priorities[parent] <= priorities[i])
                break
            this.swap(i, parent)
            i = parent
        }
    }

    pop()
    {
        const { keys, priorities } = this
        const top = keys[0]
        this.lastPriority = priorities[0]

        const lastKey = keys.pop()
        const lastPriority = priorities.pop()
        if(keys.length)
        {
            keys[0] = lastKey
            priorities[0] = lastPriority

            let i = 0
            while(true)
            {
                const left = 2 * i + 1
                const right = left + 1
                let smallest = i
                if(left < keys.length && priorities[left] < priorities[smallest])
                    smallest = left
                if(right < keys.length && priorities[right] < priorities[smallest])
                    smallest = right
                if(smallest === i)
                    break
                this.swap(i, smallest)
                i = smallest
            }
        }
        return top
    }

    swap(a, b)
    {
        const { keys, priorities } = this
        ;[keys[a], keys[b]] = [keys[b], keys[a]]
        ;[priorities[a], priorities[b]] = [priorities[b], priorities[a]]
    }
}
