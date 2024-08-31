const path = require("path");

const moment = require("moment");
const handlebars = require("handlebars");
const yaml = require("js-yaml");
const sass = require("sass");

const { Encoder, ErrorCorrectionLevel, QRByte } = require("@nuintun/qrcode");
const {parse} = require("csv-parse/sync");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("files/**/*.*");

  // Applies a template to all the nodes of a tree structure
  eleventyConfig.addHandlebarsHelper(
    "traverse",
    function (object, options) {
      let key = options.hash["children"];
      if (object) {
        let rendered = "";
        let queue = object instanceof Array ? object.slice() : [object];

        while (queue.length) {
          let next = queue.shift();
          rendered += options.fn(next);

          if (next[key] instanceof Array) {
            queue = next[key].concat(queue);
          }
        }

        return rendered;
      }
    }
  );

  function cmp(v1, v2) {
    if (v1 > v2) {
      return 1;
    } else if (v1 < v2) {
      return -1;
    } else {
      return 0;
    }
  }

  function makeCompareFn(key, dir, ...rest) {
    let dirCmp;

    switch (dir) {
      case 'desc':
        dirCmp = (v1, v2) => cmp(v2 && v2[key], v1 && v1[key]);
        break;
      case 'num_desc':
        dirCmp = (v1, v2) => {
          let n1 = Number(v1 && v1[key]);
          let n2 = Number(v2 && v2[key]);
          if (!Number.isNaN(n1)) {
            if (!Number.isNaN(n2)) {
              // Both numbers
              return cmp(n2, n1);
            } else {
              // Numbers first
              return -1;
            }
          } else if (!Number.isNaN(n2)) {
            // Numbers first
            return 1;
          } else {
            // Both not numbers
            return cmp(v2 && v2[key], v1 && v1[key]);
          }
        };

        break;
      case 'num_asc':
        dirCmp = (v1, v2) => {
          let n1 = Number(v1 && v1[key]);
          let n2 = Number(v2 && v2[key]);
          if (!Number.isNaN(n1)) {
            if (!Number.isNaN(n2)) {
              // Both numbers
              return cmp(n1, n2);
            } else {
              // Numbers first
              return -1;
            }
          } else if (!Number.isNaN(n2)) {
            // Numbers first
            return 1;
          } else {
            // Both not numbers
            return cmp(v1 && v1[key], v2 && v2[key]);
          }
        };

        break;
      case 'asc':
      default:
        dirCmp = (v1, v2) => cmp(v1 && v1[key], v2 && v2[key])
        break;
    }

    if (rest?.length) {
      const restCmp = makeCompareFn(...rest);
      return (v1, v2) => {
        const c = dirCmp(v1, v2);
        if (c === 0) {
          return restCmp(v1, v2);
        } else {
          return c;
        }
      }
    } else {
      return dirCmp;
    }
  }

  eleventyConfig.addHandlebarsHelper(
    "sorted-each",
    function () {
      let [list, ...ordering] = Array.from(arguments).slice(0, -1);
      let body = arguments[arguments.length - 1];
      if (list && list.length) {
        // sort list
        let sorted = [...list];
        sorted.sort(makeCompareFn(...ordering));
        return sorted.reduce(
          (result, value) => {
            return result + body.fn(value);
          },
          ''
        );
      } else if (body.inverse) {
        return body.inverse();
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "if-any",
    function () {
      let conditions = Array.from(arguments).slice(0, -1);
      let options = arguments[arguments.length - 1];
      let value = conditions.filter(v => v)[0];
      if (value) {
        return options.fn({...this, value});
      } else if (options.inverse) {
        return options.inverse();
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "if-equal",
    function () {
      let values = Array.from(arguments).slice(0, -1);
      let options = arguments[arguments.length - 1];
      let val = values.length === 2 ? values[1] : options.hash["value"];
      if (values[0] == val) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "if-not-equal",
    function () {
      let values = Array.from(arguments).slice(0, -1);
      let options = arguments[arguments.length - 1];
      let val = values.length === 2 ? values[1] : options.hash["value"];
      if (values[0] != val) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "if-future",
    function (dateString, options) {
      if (moment(dateString).isAfter(moment())) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$take",
    (source, count) => source.slice(0, count)
  );

  eleventyConfig.addHandlebarsHelper(
    "$filter-by",
    (source, key, value) => source.filter(v => v && v[key] === value)
  );

  eleventyConfig.addHandlebarsHelper(
    "$group-by",
    (source, key) => {
      const groups = [];
      for (const v of source) {
        const k = v[key];
        let existing = groups.find(g => g.key === k);
        if (!existing) {
          groups.push(existing = { key: k, values: [] });
        }
        existing.values.push(v);
      }

      return groups;
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$not-empty",
    (source) => !!(source?.length)
  );

  eleventyConfig.addHandlebarsHelper(
    "$get",
    (obj, key) => {
      return obj[key];
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$getLogged",
    (obj, key) => {
      console.log('trying to get ' + key + ' from ' + obj);
      return obj[key];
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$coalesce",
    function () {
      let ary = Array.from(arguments).slice(0, -1);
      if (ary instanceof Array) {
        for (let item of ary) {
          if (item) {
            return item;
          }
        }

        return undefined;
      } else {
        return ary;
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$lower",
    function (str, options) {
      if (typeof str === "string") {
        return str.toLocaleLowerCase();
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$upper",
    function (str, options) {
      if (typeof str === "string") {
        return str.toLocaleUpperCase();
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$strip",
    function (str, chars) {
      if (str && chars) {
        let charArray = Array.from(chars);
        let result = '';
        for (let i = 0; i < str.length; i++) {
          if (!charArray.includes(str[i])) {
            result += str[i];
          }
        }
        return result;
      } else {
        return str;
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$formatDate",
    function (str, format) {
      if (str && format) {
        return moment(str).format(format);
      } else {
        return str;
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$abbr",
    function (obj, className) {
      if (obj && obj.abbreviation) {
        let classAttr =
          typeof className === "string" ?
            ` class="${className}"` :
            '';
        return new handlebars.SafeString(
          `<abbr title="${obj.text}"${classAttr}>${obj.abbreviation}</abbr>`
        )
      } else {
        return obj;
      }
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$concat",
    function () {
      let ary = Array.from(arguments).slice(0, -1);
      let str = ary[0];
      for (const val of ary.slice(1)) {
        str += val;
      }

      return str;
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$replaceAll",
    function (str, search, replace) {
      return str.replaceAll(search, replace);
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$log",
    function (value) {
      console.log((typeof value) + (value && value.prototype ? ': ' + value.prototype.constructor.name : ''));
      console.log(value);
      return value;
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$urlEncoded",
    function (value) {
      return value && encodeURIComponent(value);
    }
  );

  eleventyConfig.addHandlebarsHelper(
    "$qrCode",
    function(url) {
      let encoder = new Encoder({errorCorrectionLevel: ErrorCorrectionLevel.M});
      encoder.write(new QRByte(url));
      encoder.make();
      return encoder.toDataURL(5, 10);
    }
  );

  eleventyConfig.setFrontMatterParsingOptions({
    delimiters: ['/*---', '---*/']
  });

  eleventyConfig.setDynamicPermalinks(true);

  eleventyConfig.addDataExtension("yml", contents => yaml.load(contents));

  eleventyConfig.addDataExtension(
    "csv",
    contents => {
      const records = parse(contents, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
      });
      // console.log(`${records.length} records found.`);
      return records.map(row => {
        const result = {};
        for (const key of Object.keys(row)) {
          if (row.hasOwnProperty(key)) {
            result[key.replace(/ /g, '_')] = row[key];
          }
        }
        return result;
      });
    }
  )

  eleventyConfig.addPassthroughCopy("style/*.css");
  eleventyConfig.addTemplateFormats("scss");

  // Creates the extension for use
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css", // optional, default: "html"

    // `compile` is called once per .scss file in the input directory
    compile: function (inputContent, inputPath) {
      let parsed = path.parse(inputPath);

      let result = sass.compileString(inputContent, {
        loadPaths: [
          parsed.dir || ".",
          this.config.dir.includes
        ]
      });

      return (data) => {
        return result.css;
      };
    }
  });
};
