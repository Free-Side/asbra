const {parse} = require('csv-parse/sync');
const fs = require('fs');

module.exports = function () {
  const contents = fs.readFileSync('./_data/seriesPoints.csv');

  const records = parse(contents, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
  });
  const allResults = records.map(row => {
    const result = {};
    for (const key of Object.keys(row)) {
      if (row.hasOwnProperty(key)) {
        result[key.replace(/ /g, '_')] = row[key];
      }
    }
    return result;
  });

  const events =
    Object.keys(allResults[0])
      .filter(k => k.endsWith('_Place'))
      .map(k => k.slice(0, -6));

  let output = [];
  for (const e of events) {
    output.push({
      'name': e.replaceAll('_', ' '),
      'results':
        allResults
          .filter(r => {
            const place = r[e + '_Place'];
            return place != null && place !== '-';
          })
          .map(r => ({
            Full_Name: r['Full_Name'],
            Category: r[e + '_Category'],
            Place: r[e + '_Place'],
            Points: r[e + '_Points'],
          }))
    });
  }

  return output;
}
