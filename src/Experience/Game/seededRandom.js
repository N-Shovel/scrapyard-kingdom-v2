// mulberry32: the same seed always gives the same map, which is what the tests rely on.
export default function seededRandom(seed)
{
    let state = seed >>> 0

    return () =>
    {
        state = (state + 0x6D2B79F5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
