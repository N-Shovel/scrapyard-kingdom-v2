// CREDITS.md as data for the credits sheet: each table under its heading, each row as cells.
// A cell is { text, url }: url is set when the cell is one markdown link to a web page.
// No DOM here, so `npm test` can run it.
export default function readCredits(markdown)
{
    const sections = []
    let section = { heading: '', rows: [] }
    let header = true

    // Windows checkouts end lines with \r\n
    for(const line of markdown.split(/\r?\n/))
    {
        if(line.startsWith('## '))
        {
            section = { heading: line.slice(3).trim(), rows: [] }
            header = true
            continue
        }
        if(!line.startsWith('|'))
        {
            header = true
            continue
        }
        // The first row of a table names its columns, the second is the |---| line
        if(header || /^\|[\s|:-]+\|$/.test(line))
        {
            header = false
            continue
        }

        // Split on pipes that are not escaped, then unescape the rest
        const cells = line.slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
        if(!sections.includes(section))
            sections.push(section)
        section.rows.push(cells.map((cell) =>
        {
            const link = cell.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
            return link ? { text: link[1], url: link[2] } : { text: cell.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, ''), url: null }
        }))
    }
    return sections
}
