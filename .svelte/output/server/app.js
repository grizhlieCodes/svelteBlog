import {randomBytes, createHash} from "crypto";
import http from "http";
import https from "https";
import zlib from "zlib";
import Stream, {PassThrough, pipeline} from "stream";
import {types} from "util";
import {format, parse, resolve, URLSearchParams as URLSearchParams$1} from "url";
var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped$1 = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function devalue(value) {
  var counts = new Map();
  function walk(thing) {
    if (typeof thing === "function") {
      throw new Error("Cannot stringify a function");
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          var proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            throw new Error("Cannot stringify arbitrary non-POJOs");
          }
          if (Object.getOwnPropertySymbols(thing).length > 0) {
            throw new Error("Cannot stringify POJOs with symbolic keys");
          }
          Object.keys(thing).forEach(function(key) {
            return walk(thing[key]);
          });
      }
    }
  }
  walk(value);
  var names = new Map();
  Array.from(counts).filter(function(entry) {
    return entry[1] > 1;
  }).sort(function(a, b) {
    return b[1] - a[1];
  }).forEach(function(entry, i) {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    var type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return "Object(" + stringify(thing.valueOf()) + ")";
      case "RegExp":
        return "new RegExp(" + stringifyString(thing.source) + ', "' + thing.flags + '")';
      case "Date":
        return "new Date(" + thing.getTime() + ")";
      case "Array":
        var members = thing.map(function(v, i) {
          return i in thing ? stringify(v) : "";
        });
        var tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return "[" + members.join(",") + tail + "]";
      case "Set":
      case "Map":
        return "new " + type + "([" + Array.from(thing).map(stringify).join(",") + "])";
      default:
        var obj = "{" + Object.keys(thing).map(function(key) {
          return safeKey(key) + ":" + stringify(thing[key]);
        }).join(",") + "}";
        var proto = Object.getPrototypeOf(thing);
        if (proto === null) {
          return Object.keys(thing).length > 0 ? "Object.assign(Object.create(null)," + obj + ")" : "Object.create(null)";
        }
        return obj;
    }
  }
  var str = stringify(value);
  if (names.size) {
    var params_1 = [];
    var statements_1 = [];
    var values_1 = [];
    names.forEach(function(name2, thing) {
      params_1.push(name2);
      if (isPrimitive(thing)) {
        values_1.push(stringifyPrimitive(thing));
        return;
      }
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values_1.push("Object(" + stringify(thing.valueOf()) + ")");
          break;
        case "RegExp":
          values_1.push(thing.toString());
          break;
        case "Date":
          values_1.push("new Date(" + thing.getTime() + ")");
          break;
        case "Array":
          values_1.push("Array(" + thing.length + ")");
          thing.forEach(function(v, i) {
            statements_1.push(name2 + "[" + i + "]=" + stringify(v));
          });
          break;
        case "Set":
          values_1.push("new Set");
          statements_1.push(name2 + "." + Array.from(thing).map(function(v) {
            return "add(" + stringify(v) + ")";
          }).join("."));
          break;
        case "Map":
          values_1.push("new Map");
          statements_1.push(name2 + "." + Array.from(thing).map(function(_a) {
            var k = _a[0], v = _a[1];
            return "set(" + stringify(k) + ", " + stringify(v) + ")";
          }).join("."));
          break;
        default:
          values_1.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach(function(key) {
            statements_1.push("" + name2 + safeProp(key) + "=" + stringify(thing[key]));
          });
      }
    });
    statements_1.push("return " + str);
    return "(function(" + params_1.join(",") + "){" + statements_1.join(";") + "}(" + values_1.join(",") + "))";
  } else {
    return str;
  }
}
function getName(num) {
  var name2 = "";
  do {
    name2 = chars[num % chars.length] + name2;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name2) ? name2 + "_" : name2;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string")
    return stringifyString(thing);
  if (thing === void 0)
    return "void 0";
  if (thing === 0 && 1 / thing < 0)
    return "-0";
  var str = String(thing);
  if (typeof thing === "number")
    return str.replace(/^(-)?0\./, "$1.");
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
  var result = '"';
  for (var i = 0; i < str.length; i += 1) {
    var char = str.charAt(i);
    var code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$1) {
      result += escaped$1[char];
    } else if (code >= 55296 && code <= 57343) {
      var next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += "\\u" + code.toString(16).toUpperCase();
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data2 = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data2, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
var src = dataUriToBuffer;
const {Readable} = Stream;
const wm = new WeakMap();
async function* read(parts) {
  for (const part of parts) {
    if ("stream" in part) {
      yield* part.stream();
    } else {
      yield part;
    }
  }
}
class Blob {
  constructor(blobParts = [], options = {type: ""}) {
    let size = 0;
    const parts = blobParts.map((element) => {
      let buffer;
      if (element instanceof Buffer) {
        buffer = element;
      } else if (ArrayBuffer.isView(element)) {
        buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
      } else if (element instanceof ArrayBuffer) {
        buffer = Buffer.from(element);
      } else if (element instanceof Blob) {
        buffer = element;
      } else {
        buffer = Buffer.from(typeof element === "string" ? element : String(element));
      }
      size += buffer.length || buffer.size || 0;
      return buffer;
    });
    const type = options.type === void 0 ? "" : String(options.type).toLowerCase();
    wm.set(this, {
      type: /[^\u0020-\u007E]/.test(type) ? "" : type,
      size,
      parts
    });
  }
  get size() {
    return wm.get(this).size;
  }
  get type() {
    return wm.get(this).type;
  }
  async text() {
    return Buffer.from(await this.arrayBuffer()).toString();
  }
  async arrayBuffer() {
    const data2 = new Uint8Array(this.size);
    let offset = 0;
    for await (const chunk of this.stream()) {
      data2.set(chunk, offset);
      offset += chunk.length;
    }
    return data2.buffer;
  }
  stream() {
    return Readable.from(read(wm.get(this).parts));
  }
  slice(start = 0, end = this.size, type = "") {
    const {size} = this;
    let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);
    const span = Math.max(relativeEnd - relativeStart, 0);
    const parts = wm.get(this).parts.values();
    const blobParts = [];
    let added = 0;
    for (const part of parts) {
      const size2 = ArrayBuffer.isView(part) ? part.byteLength : part.size;
      if (relativeStart && size2 <= relativeStart) {
        relativeStart -= size2;
        relativeEnd -= size2;
      } else {
        const chunk = part.slice(relativeStart, Math.min(size2, relativeEnd));
        blobParts.push(chunk);
        added += ArrayBuffer.isView(chunk) ? chunk.byteLength : chunk.size;
        relativeStart = 0;
        if (added >= span) {
          break;
        }
      }
    }
    const blob = new Blob([], {type});
    Object.assign(wm.get(blob), {size: span, parts: blobParts});
    return blob;
  }
  get [Symbol.toStringTag]() {
    return "Blob";
  }
  static [Symbol.hasInstance](object) {
    return typeof object === "object" && typeof object.stream === "function" && object.stream.length === 0 && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[Symbol.toStringTag]);
  }
}
Object.defineProperties(Blob.prototype, {
  size: {enumerable: true},
  type: {enumerable: true},
  slice: {enumerable: true}
});
var fetchBlob = Blob;
class FetchBaseError extends Error {
  constructor(message, type) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.type = type;
  }
  get name() {
    return this.constructor.name;
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}
class FetchError extends FetchBaseError {
  constructor(message, type, systemError) {
    super(message, type);
    if (systemError) {
      this.code = this.errno = systemError.code;
      this.erroredSysCall = systemError.syscall;
    }
  }
}
const NAME$1 = Symbol.toStringTag;
const isURLSearchParameters = (object) => {
  return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME$1] === "URLSearchParams";
};
const isBlob$1 = (object) => {
  return typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME$1]);
};
function isFormData$1(object) {
  return typeof object === "object" && typeof object.append === "function" && typeof object.set === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.delete === "function" && typeof object.keys === "function" && typeof object.values === "function" && typeof object.entries === "function" && typeof object.constructor === "function" && object[NAME$1] === "FormData";
}
const isAbortSignal = (object) => {
  return typeof object === "object" && object[NAME$1] === "AbortSignal";
};
const carriage = "\r\n";
const dashes = "-".repeat(2);
const carriageLength = Buffer.byteLength(carriage);
const getFooter = (boundary) => `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
function getHeader(boundary, name2, field) {
  let header = "";
  header += `${dashes}${boundary}${carriage}`;
  header += `Content-Disposition: form-data; name="${name2}"`;
  if (isBlob$1(field)) {
    header += `; filename="${field.name}"${carriage}`;
    header += `Content-Type: ${field.type || "application/octet-stream"}`;
  }
  return `${header}${carriage.repeat(2)}`;
}
const getBoundary = () => randomBytes(8).toString("hex");
async function* formDataIterator(form, boundary) {
  for (const [name2, value] of form) {
    yield getHeader(boundary, name2, value);
    if (isBlob$1(value)) {
      yield* value.stream();
    } else {
      yield value;
    }
    yield carriage;
  }
  yield getFooter(boundary);
}
function getFormDataLength(form, boundary) {
  let length = 0;
  for (const [name2, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name2, value));
    if (isBlob$1(value)) {
      length += value.size;
    } else {
      length += Buffer.byteLength(String(value));
    }
    length += carriageLength;
  }
  length += Buffer.byteLength(getFooter(boundary));
  return length;
}
const INTERNALS$2 = Symbol("Body internals");
class Body {
  constructor(body, {
    size = 0
  } = {}) {
    let boundary = null;
    if (body === null) {
      body = null;
    } else if (isURLSearchParameters(body)) {
      body = Buffer.from(body.toString());
    } else if (isBlob$1(body))
      ;
    else if (Buffer.isBuffer(body))
      ;
    else if (types.isAnyArrayBuffer(body)) {
      body = Buffer.from(body);
    } else if (ArrayBuffer.isView(body)) {
      body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof Stream)
      ;
    else if (isFormData$1(body)) {
      boundary = `NodeFetchFormDataBoundary${getBoundary()}`;
      body = Stream.Readable.from(formDataIterator(body, boundary));
    } else {
      body = Buffer.from(String(body));
    }
    this[INTERNALS$2] = {
      body,
      boundary,
      disturbed: false,
      error: null
    };
    this.size = size;
    if (body instanceof Stream) {
      body.on("error", (err) => {
        const error2 = err instanceof FetchBaseError ? err : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, "system", err);
        this[INTERNALS$2].error = error2;
      });
    }
  }
  get body() {
    return this[INTERNALS$2].body;
  }
  get bodyUsed() {
    return this[INTERNALS$2].disturbed;
  }
  async arrayBuffer() {
    const {buffer, byteOffset, byteLength} = await consumeBody(this);
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  async blob() {
    const ct = this.headers && this.headers.get("content-type") || this[INTERNALS$2].body && this[INTERNALS$2].body.type || "";
    const buf = await this.buffer();
    return new fetchBlob([buf], {
      type: ct
    });
  }
  async json() {
    const buffer = await consumeBody(this);
    return JSON.parse(buffer.toString());
  }
  async text() {
    const buffer = await consumeBody(this);
    return buffer.toString();
  }
  buffer() {
    return consumeBody(this);
  }
}
Object.defineProperties(Body.prototype, {
  body: {enumerable: true},
  bodyUsed: {enumerable: true},
  arrayBuffer: {enumerable: true},
  blob: {enumerable: true},
  json: {enumerable: true},
  text: {enumerable: true}
});
async function consumeBody(data2) {
  if (data2[INTERNALS$2].disturbed) {
    throw new TypeError(`body used already for: ${data2.url}`);
  }
  data2[INTERNALS$2].disturbed = true;
  if (data2[INTERNALS$2].error) {
    throw data2[INTERNALS$2].error;
  }
  let {body} = data2;
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (isBlob$1(body)) {
    body = body.stream();
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (!(body instanceof Stream)) {
    return Buffer.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data2.size > 0 && accumBytes + chunk.length > data2.size) {
        const err = new FetchError(`content size at ${data2.url} over limit: ${data2.size}`, "max-size");
        body.destroy(err);
        throw err;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error2) {
    if (error2 instanceof FetchBaseError) {
      throw error2;
    } else {
      throw new FetchError(`Invalid response body while trying to fetch ${data2.url}: ${error2.message}`, "system", error2);
    }
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer.from(accum.join(""));
      }
      return Buffer.concat(accum, accumBytes);
    } catch (error2) {
      throw new FetchError(`Could not create Buffer from response body for ${data2.url}: ${error2.message}`, "system", error2);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data2.url}`);
  }
}
const clone = (instance, highWaterMark) => {
  let p1;
  let p2;
  let {body} = instance;
  if (instance.bodyUsed) {
    throw new Error("cannot clone body after it is used");
  }
  if (body instanceof Stream && typeof body.getBoundary !== "function") {
    p1 = new PassThrough({highWaterMark});
    p2 = new PassThrough({highWaterMark});
    body.pipe(p1);
    body.pipe(p2);
    instance[INTERNALS$2].body = p1;
    body = p2;
  }
  return body;
};
const extractContentType = (body, request2) => {
  if (body === null) {
    return null;
  }
  if (typeof body === "string") {
    return "text/plain;charset=UTF-8";
  }
  if (isURLSearchParameters(body)) {
    return "application/x-www-form-urlencoded;charset=UTF-8";
  }
  if (isBlob$1(body)) {
    return body.type || null;
  }
  if (Buffer.isBuffer(body) || types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
    return null;
  }
  if (body && typeof body.getBoundary === "function") {
    return `multipart/form-data;boundary=${body.getBoundary()}`;
  }
  if (isFormData$1(body)) {
    return `multipart/form-data; boundary=${request2[INTERNALS$2].boundary}`;
  }
  if (body instanceof Stream) {
    return null;
  }
  return "text/plain;charset=UTF-8";
};
const getTotalBytes = (request2) => {
  const {body} = request2;
  if (body === null) {
    return 0;
  }
  if (isBlob$1(body)) {
    return body.size;
  }
  if (Buffer.isBuffer(body)) {
    return body.length;
  }
  if (body && typeof body.getLengthSync === "function") {
    return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
  }
  if (isFormData$1(body)) {
    return getFormDataLength(request2[INTERNALS$2].boundary);
  }
  return null;
};
const writeToStream = (dest, {body}) => {
  if (body === null) {
    dest.end();
  } else if (isBlob$1(body)) {
    body.stream().pipe(dest);
  } else if (Buffer.isBuffer(body)) {
    dest.write(body);
    dest.end();
  } else {
    body.pipe(dest);
  }
};
const validateHeaderName = typeof http.validateHeaderName === "function" ? http.validateHeaderName : (name2) => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name2)) {
    const err = new TypeError(`Header name must be a valid HTTP token [${name2}]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_HTTP_TOKEN"});
    throw err;
  }
};
const validateHeaderValue = typeof http.validateHeaderValue === "function" ? http.validateHeaderValue : (name2, value) => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
    const err = new TypeError(`Invalid character in header content ["${name2}"]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_CHAR"});
    throw err;
  }
};
class Headers extends URLSearchParams {
  constructor(init2) {
    let result = [];
    if (init2 instanceof Headers) {
      const raw = init2.raw();
      for (const [name2, values] of Object.entries(raw)) {
        result.push(...values.map((value) => [name2, value]));
      }
    } else if (init2 == null)
      ;
    else if (typeof init2 === "object" && !types.isBoxedPrimitive(init2)) {
      const method = init2[Symbol.iterator];
      if (method == null) {
        result.push(...Object.entries(init2));
      } else {
        if (typeof method !== "function") {
          throw new TypeError("Header pairs must be iterable");
        }
        result = [...init2].map((pair) => {
          if (typeof pair !== "object" || types.isBoxedPrimitive(pair)) {
            throw new TypeError("Each header pair must be an iterable object");
          }
          return [...pair];
        }).map((pair) => {
          if (pair.length !== 2) {
            throw new TypeError("Each header pair must be a name/value tuple");
          }
          return [...pair];
        });
      }
    } else {
      throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
    }
    result = result.length > 0 ? result.map(([name2, value]) => {
      validateHeaderName(name2);
      validateHeaderValue(name2, String(value));
      return [String(name2).toLowerCase(), String(value)];
    }) : void 0;
    super(result);
    return new Proxy(this, {
      get(target, p, receiver) {
        switch (p) {
          case "append":
          case "set":
            return (name2, value) => {
              validateHeaderName(name2);
              validateHeaderValue(name2, String(value));
              return URLSearchParams.prototype[p].call(receiver, String(name2).toLowerCase(), String(value));
            };
          case "delete":
          case "has":
          case "getAll":
            return (name2) => {
              validateHeaderName(name2);
              return URLSearchParams.prototype[p].call(receiver, String(name2).toLowerCase());
            };
          case "keys":
            return () => {
              target.sort();
              return new Set(URLSearchParams.prototype.keys.call(target)).keys();
            };
          default:
            return Reflect.get(target, p, receiver);
        }
      }
    });
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    return Object.prototype.toString.call(this);
  }
  get(name2) {
    const values = this.getAll(name2);
    if (values.length === 0) {
      return null;
    }
    let value = values.join(", ");
    if (/^content-encoding$/i.test(name2)) {
      value = value.toLowerCase();
    }
    return value;
  }
  forEach(callback) {
    for (const name2 of this.keys()) {
      callback(this.get(name2), name2);
    }
  }
  *values() {
    for (const name2 of this.keys()) {
      yield this.get(name2);
    }
  }
  *entries() {
    for (const name2 of this.keys()) {
      yield [name2, this.get(name2)];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  raw() {
    return [...this.keys()].reduce((result, key) => {
      result[key] = this.getAll(key);
      return result;
    }, {});
  }
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this.keys()].reduce((result, key) => {
      const values = this.getAll(key);
      if (key === "host") {
        result[key] = values[0];
      } else {
        result[key] = values.length > 1 ? values : values[0];
      }
      return result;
    }, {});
  }
}
Object.defineProperties(Headers.prototype, ["get", "entries", "forEach", "values"].reduce((result, property) => {
  result[property] = {enumerable: true};
  return result;
}, {}));
function fromRawHeaders(headers = []) {
  return new Headers(headers.reduce((result, value, index2, array) => {
    if (index2 % 2 === 0) {
      result.push(array.slice(index2, index2 + 2));
    }
    return result;
  }, []).filter(([name2, value]) => {
    try {
      validateHeaderName(name2);
      validateHeaderValue(name2, String(value));
      return true;
    } catch (e) {
      return false;
    }
  }));
}
const redirectStatus = new Set([301, 302, 303, 307, 308]);
const isRedirect = (code) => {
  return redirectStatus.has(code);
};
const INTERNALS$1 = Symbol("Response internals");
class Response extends Body {
  constructor(body = null, options = {}) {
    super(body, options);
    const status = options.status || 200;
    const headers = new Headers(options.headers);
    if (body !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(body);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    this[INTERNALS$1] = {
      url: options.url,
      status,
      statusText: options.statusText || "",
      headers,
      counter: options.counter,
      highWaterMark: options.highWaterMark
    };
  }
  get url() {
    return this[INTERNALS$1].url || "";
  }
  get status() {
    return this[INTERNALS$1].status;
  }
  get ok() {
    return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
  }
  get redirected() {
    return this[INTERNALS$1].counter > 0;
  }
  get statusText() {
    return this[INTERNALS$1].statusText;
  }
  get headers() {
    return this[INTERNALS$1].headers;
  }
  get highWaterMark() {
    return this[INTERNALS$1].highWaterMark;
  }
  clone() {
    return new Response(clone(this, this.highWaterMark), {
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      ok: this.ok,
      redirected: this.redirected,
      size: this.size
    });
  }
  static redirect(url, status = 302) {
    if (!isRedirect(status)) {
      throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
    }
    return new Response(null, {
      headers: {
        location: new URL(url).toString()
      },
      status
    });
  }
  get [Symbol.toStringTag]() {
    return "Response";
  }
}
Object.defineProperties(Response.prototype, {
  url: {enumerable: true},
  status: {enumerable: true},
  ok: {enumerable: true},
  redirected: {enumerable: true},
  statusText: {enumerable: true},
  headers: {enumerable: true},
  clone: {enumerable: true}
});
const getSearch = (parsedURL) => {
  if (parsedURL.search) {
    return parsedURL.search;
  }
  const lastOffset = parsedURL.href.length - 1;
  const hash = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
  return parsedURL.href[lastOffset - hash.length] === "?" ? "?" : "";
};
const INTERNALS = Symbol("Request internals");
const isRequest = (object) => {
  return typeof object === "object" && typeof object[INTERNALS] === "object";
};
class Request extends Body {
  constructor(input, init2 = {}) {
    let parsedURL;
    if (isRequest(input)) {
      parsedURL = new URL(input.url);
    } else {
      parsedURL = new URL(input);
      input = {};
    }
    let method = init2.method || input.method || "GET";
    method = method.toUpperCase();
    if ((init2.body != null || isRequest(input)) && input.body !== null && (method === "GET" || method === "HEAD")) {
      throw new TypeError("Request with GET/HEAD method cannot have body");
    }
    const inputBody = init2.body ? init2.body : isRequest(input) && input.body !== null ? clone(input) : null;
    super(inputBody, {
      size: init2.size || input.size || 0
    });
    const headers = new Headers(init2.headers || input.headers || {});
    if (inputBody !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(inputBody, this);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    let signal = isRequest(input) ? input.signal : null;
    if ("signal" in init2) {
      signal = init2.signal;
    }
    if (signal !== null && !isAbortSignal(signal)) {
      throw new TypeError("Expected signal to be an instanceof AbortSignal");
    }
    this[INTERNALS] = {
      method,
      redirect: init2.redirect || input.redirect || "follow",
      headers,
      parsedURL,
      signal
    };
    this.follow = init2.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init2.follow;
    this.compress = init2.compress === void 0 ? input.compress === void 0 ? true : input.compress : init2.compress;
    this.counter = init2.counter || input.counter || 0;
    this.agent = init2.agent || input.agent;
    this.highWaterMark = init2.highWaterMark || input.highWaterMark || 16384;
    this.insecureHTTPParser = init2.insecureHTTPParser || input.insecureHTTPParser || false;
  }
  get method() {
    return this[INTERNALS].method;
  }
  get url() {
    return format(this[INTERNALS].parsedURL);
  }
  get headers() {
    return this[INTERNALS].headers;
  }
  get redirect() {
    return this[INTERNALS].redirect;
  }
  get signal() {
    return this[INTERNALS].signal;
  }
  clone() {
    return new Request(this);
  }
  get [Symbol.toStringTag]() {
    return "Request";
  }
}
Object.defineProperties(Request.prototype, {
  method: {enumerable: true},
  url: {enumerable: true},
  headers: {enumerable: true},
  redirect: {enumerable: true},
  clone: {enumerable: true},
  signal: {enumerable: true}
});
const getNodeRequestOptions = (request2) => {
  const {parsedURL} = request2[INTERNALS];
  const headers = new Headers(request2[INTERNALS].headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }
  let contentLengthValue = null;
  if (request2.body === null && /^(post|put)$/i.test(request2.method)) {
    contentLengthValue = "0";
  }
  if (request2.body !== null) {
    const totalBytes = getTotalBytes(request2);
    if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
      contentLengthValue = String(totalBytes);
    }
  }
  if (contentLengthValue) {
    headers.set("Content-Length", contentLengthValue);
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "node-fetch");
  }
  if (request2.compress && !headers.has("Accept-Encoding")) {
    headers.set("Accept-Encoding", "gzip,deflate,br");
  }
  let {agent} = request2;
  if (typeof agent === "function") {
    agent = agent(parsedURL);
  }
  if (!headers.has("Connection") && !agent) {
    headers.set("Connection", "close");
  }
  const search = getSearch(parsedURL);
  const requestOptions = {
    path: parsedURL.pathname + search,
    pathname: parsedURL.pathname,
    hostname: parsedURL.hostname,
    protocol: parsedURL.protocol,
    port: parsedURL.port,
    hash: parsedURL.hash,
    search: parsedURL.search,
    query: parsedURL.query,
    href: parsedURL.href,
    method: request2.method,
    headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
    insecureHTTPParser: request2.insecureHTTPParser,
    agent
  };
  return requestOptions;
};
class AbortError extends FetchBaseError {
  constructor(message, type = "aborted") {
    super(message, type);
  }
}
const supportedSchemas = new Set(["data:", "http:", "https:"]);
async function fetch(url, options_) {
  return new Promise((resolve3, reject2) => {
    const request2 = new Request(url, options_);
    const options = getNodeRequestOptions(request2);
    if (!supportedSchemas.has(options.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${options.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (options.protocol === "data:") {
      const data2 = src(request2.url);
      const response2 = new Response(data2, {headers: {"Content-Type": data2.typeFull}});
      resolve3(response2);
      return;
    }
    const send = (options.protocol === "https:" ? https : http).request;
    const {signal} = request2;
    let response = null;
    const abort = () => {
      const error2 = new AbortError("The operation was aborted.");
      reject2(error2);
      if (request2.body && request2.body instanceof Stream.Readable) {
        request2.body.destroy(error2);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error2);
    };
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = () => {
      abort();
      finalize();
    };
    const request_ = send(options);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = () => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    };
    request_.on("error", (err) => {
      reject2(new FetchError(`request to ${request2.url} failed, reason: ${err.message}`, "system", err));
      finalize();
    });
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location2 = headers.get("Location");
        const locationURL = location2 === null ? null : new URL(location2, request2.url);
        switch (request2.redirect) {
          case "error":
            reject2(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request2.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            if (locationURL !== null) {
              try {
                headers.set("Location", locationURL);
              } catch (error2) {
                reject2(error2);
              }
            }
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request2.counter >= request2.follow) {
              reject2(new FetchError(`maximum redirect reached at: ${request2.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request2.headers),
              follow: request2.follow,
              counter: request2.counter + 1,
              agent: request2.agent,
              compress: request2.compress,
              method: request2.method,
              body: request2.body,
              signal: request2.signal,
              size: request2.size
            };
            if (response_.statusCode !== 303 && request2.body && options_.body instanceof Stream.Readable) {
              reject2(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request2.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            resolve3(fetch(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
        }
      }
      response_.once("end", () => {
        if (signal) {
          signal.removeEventListener("abort", abortAndFinalize);
        }
      });
      let body = pipeline(response_, new PassThrough(), (error2) => {
        reject2(error2);
      });
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request2.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request2.size,
        counter: request2.counter,
        highWaterMark: request2.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request2.compress || request2.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve3(response);
        return;
      }
      const zlibOptions = {
        flush: zlib.Z_SYNC_FLUSH,
        finishFlush: zlib.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = pipeline(body, zlib.createGunzip(zlibOptions), (error2) => {
          reject2(error2);
        });
        response = new Response(body, responseOptions);
        resolve3(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw = pipeline(response_, new PassThrough(), (error2) => {
          reject2(error2);
        });
        raw.once("data", (chunk) => {
          if ((chunk[0] & 15) === 8) {
            body = pipeline(body, zlib.createInflate(), (error2) => {
              reject2(error2);
            });
          } else {
            body = pipeline(body, zlib.createInflateRaw(), (error2) => {
              reject2(error2);
            });
          }
          response = new Response(body, responseOptions);
          resolve3(response);
        });
        return;
      }
      if (codings === "br") {
        body = pipeline(body, zlib.createBrotliDecompress(), (error2) => {
          reject2(error2);
        });
        response = new Response(body, responseOptions);
        resolve3(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve3(response);
    });
    writeToStream(request_, request2);
  });
}
function noop$1() {
}
function safe_not_equal$1(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
const subscriber_queue$1 = [];
function writable$1(value, start = noop$1) {
  let stop;
  const subscribers = [];
  function set2(new_value) {
    if (safe_not_equal$1(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue$1.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s2 = subscribers[i];
          s2[1]();
          subscriber_queue$1.push(s2, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue$1.length; i += 2) {
            subscriber_queue$1[i][0](subscriber_queue$1[i + 1]);
          }
          subscriber_queue$1.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set2(fn(value));
  }
  function subscribe2(run2, invalidate = noop$1) {
    const subscriber = [run2, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set2) || noop$1;
    }
    run2(value);
    return () => {
      const index2 = subscribers.indexOf(subscriber);
      if (index2 !== -1) {
        subscribers.splice(index2, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return {set: set2, update, subscribe: subscribe2};
}
function normalize$1(loaded) {
  if (loaded.error) {
    const error2 = typeof loaded.error === "string" ? new Error(loaded.error) : loaded.error;
    const status = loaded.status;
    if (!(error2 instanceof Error)) {
      return {
        status: 500,
        error: new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof error2}"`)
      };
    }
    if (!status || status < 400 || status > 599) {
      console.warn('"error" returned from load() without a valid status code \u2014 defaulting to 500');
      return {status: 500, error: error2};
    }
    return {status, error: error2};
  }
  if (loaded.redirect) {
    if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')
      };
    }
    if (typeof loaded.redirect !== "string") {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be a string')
      };
    }
  }
  return loaded;
}
const s = JSON.stringify;
async function get_response({request: request2, options, $session, route, status = 200, error: error2}) {
  const dependencies = {};
  const serialized_session = try_serialize($session, (error3) => {
    throw new Error(`Failed to serialize session data: ${error3.message}`);
  });
  const serialized_data = [];
  const match2 = route && route.pattern.exec(request2.path);
  const params = route && route.params(match2);
  const page = {
    host: request2.host,
    path: request2.path,
    query: request2.query,
    params
  };
  let uses_credentials = false;
  const fetcher = async (resource, opts = {}) => {
    let url;
    if (typeof resource === "string") {
      url = resource;
    } else {
      url = resource.url;
      opts = {
        method: resource.method,
        headers: resource.headers,
        body: resource.body,
        mode: resource.mode,
        credentials: resource.credentials,
        cache: resource.cache,
        redirect: resource.redirect,
        referrer: resource.referrer,
        integrity: resource.integrity,
        ...opts
      };
    }
    if (options.local && url.startsWith(options.paths.assets)) {
      url = url.replace(options.paths.assets, "");
    }
    const parsed = parse(url);
    if (opts.credentials !== "omit") {
      uses_credentials = true;
    }
    let response;
    if (parsed.protocol) {
      response = await fetch(parsed.href, opts);
    } else {
      const resolved = resolve(request2.path, parsed.pathname);
      const filename = resolved.slice(1);
      const filename_html = `${filename}/index.html`;
      const asset = options.manifest.assets.find((d2) => d2.file === filename || d2.file === filename_html);
      if (asset) {
        if (options.get_static_file) {
          response = new Response(options.get_static_file(asset.file), {
            headers: {
              "content-type": asset.type
            }
          });
        } else {
          response = await fetch(`http://${page.host}/${asset.file}`, opts);
        }
      }
      if (!response) {
        const rendered2 = await ssr({
          host: request2.host,
          method: opts.method || "GET",
          headers: opts.headers || {},
          path: resolved,
          body: opts.body,
          query: new URLSearchParams$1(parsed.query || "")
        }, {
          ...options,
          fetched: url,
          initiator: route
        });
        if (rendered2) {
          dependencies[resolved] = rendered2;
          response = new Response(rendered2.body, {
            status: rendered2.status,
            headers: rendered2.headers
          });
        }
      }
    }
    if (response) {
      const headers2 = {};
      response.headers.forEach((value, key) => {
        if (key !== "etag")
          headers2[key] = value;
      });
      const inline = {
        url,
        payload: {
          status: response.status,
          statusText: response.statusText,
          headers: headers2,
          body: null
        }
      };
      const proxy = new Proxy(response, {
        get(response2, key, receiver) {
          if (key === "text") {
            return async () => {
              const text = await response2.text();
              inline.payload.body = text;
              serialized_data.push(inline);
              return text;
            };
          }
          if (key === "json") {
            return async () => {
              const json = await response2.json();
              inline.payload.body = s(json);
              serialized_data.push(inline);
              return json;
            };
          }
          return Reflect.get(response2, key, receiver);
        }
      });
      return proxy;
    }
    return new Response("Not found", {
      status: 404
    });
  };
  const component_promises = error2 ? [options.manifest.layout()] : [options.manifest.layout(), ...route.parts.map((part) => part.load())];
  const components2 = [];
  const props_promises = [];
  let context = {};
  let maxage;
  let page_component;
  try {
    page_component = await component_promises[component_promises.length - 1];
  } catch (e) {
    return await get_response({
      request: request2,
      options,
      $session,
      route,
      status: 500,
      error: e instanceof Error ? e : {name: "Error", message: e.toString()}
    });
  }
  const page_config = {
    ssr: "ssr" in page_component ? page_component.ssr : options.ssr,
    router: "router" in page_component ? page_component.router : options.router,
    hydrate: "hydrate" in page_component ? page_component.hydrate : options.hydrate
  };
  if (options.only_render_prerenderable_pages) {
    if (error2)
      return;
    if (!page_component.prerender)
      return;
  }
  let rendered;
  if (page_config.ssr) {
    for (let i = 0; i < component_promises.length; i += 1) {
      let loaded;
      try {
        const mod = await component_promises[i];
        components2[i] = mod.default;
        if (mod.preload) {
          throw new Error("preload has been deprecated in favour of load. Please consult the documentation: https://kit.svelte.dev/docs#load");
        }
        if (mod.load) {
          loaded = await mod.load.call(null, {
            page,
            get session() {
              uses_credentials = true;
              return $session;
            },
            fetch: fetcher,
            context: {...context}
          });
          if (!loaded)
            return;
        }
      } catch (e) {
        if (error2)
          throw e instanceof Error ? e : new Error(e);
        loaded = {
          error: e instanceof Error ? e : {name: "Error", message: e.toString()},
          status: 500
        };
      }
      if (loaded) {
        loaded = normalize$1(loaded);
        if (loaded.error) {
          return await get_response({
            request: request2,
            options,
            $session,
            route,
            status: loaded.status,
            error: loaded.error
          });
        }
        if (loaded.redirect) {
          return {
            status: loaded.status,
            headers: {
              location: loaded.redirect
            }
          };
        }
        if (loaded.context) {
          context = {
            ...context,
            ...loaded.context
          };
        }
        maxage = loaded.maxage || 0;
        props_promises[i] = loaded.props;
      }
    }
    const session = writable$1($session);
    let session_tracking_active = false;
    const unsubscribe = session.subscribe(() => {
      if (session_tracking_active)
        uses_credentials = true;
    });
    session_tracking_active = true;
    if (error2) {
      if (options.dev) {
        error2.stack = await options.get_stack(error2);
      } else {
        error2.stack = String(error2);
      }
    }
    const props = {
      status,
      error: error2,
      stores: {
        page: writable$1(null),
        navigating: writable$1(null),
        session
      },
      page,
      components: components2
    };
    for (let i = 0; i < props_promises.length; i += 1) {
      props[`props_${i}`] = await props_promises[i];
    }
    try {
      rendered = options.root.render(props);
    } catch (e) {
      if (error2)
        throw e instanceof Error ? e : new Error(e);
      return await get_response({
        request: request2,
        options,
        $session,
        route,
        status: 500,
        error: e instanceof Error ? e : {name: "Error", message: e.toString()}
      });
    }
    unsubscribe();
  } else {
    rendered = {
      head: "",
      html: "",
      css: ""
    };
  }
  const js_deps = route ? route.js : [];
  const css_deps = route ? route.css : [];
  const style = route ? route.style : "";
  const prefix = `${options.paths.assets}/${options.app_dir}`;
  const links = options.amp ? `<style amp-custom>${style || (await Promise.all(css_deps.map((dep) => options.get_amp_css(dep)))).join("\n")}</style>` : [
    ...js_deps.map((dep) => `<link rel="modulepreload" href="${prefix}/${dep}">`),
    ...css_deps.map((dep) => `<link rel="stylesheet" href="${prefix}/${dep}">`)
  ].join("\n			");
  let init2 = "";
  if (options.amp) {
    init2 = `
		<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
		<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
		<script async src="https://cdn.ampproject.org/v0.js"></script>`;
  } else if (page_config.router || page_config.hydrate) {
    init2 = `
		<script type="module">
			import { start } from ${s(options.entry)};
			start({
				target: ${options.target ? `document.querySelector(${s(options.target)})` : "document.body"},
				paths: ${s(options.paths)},
				status: ${status},
				error: ${serialize_error(error2)},
				session: ${serialized_session},
				host: ${s(request2.host || "location.host")},
				route: ${!!page_config.router},
				hydrate: ${page_config.hydrate ? `{
					nodes: [
						${(route ? route.parts : []).map((part) => `import(${s(options.get_component_path(part.id))})`).join(",\n						")}
					],
					page: {
						host: ${s(request2.host || "location.host")}, // TODO this is redundant
						path: ${s(request2.path)},
						query: new URLSearchParams(${s(request2.query.toString())}),
						params: ${s(params)}
					}
				}` : "null"}
			});
		</script>`;
  }
  const head2 = [
    rendered.head,
    style && !options.amp ? `<style data-svelte>${style}</style>` : "",
    links,
    init2
  ].join("\n\n");
  const body = options.amp ? rendered.html : `${rendered.html}

			${serialized_data.map(({url, payload}) => `<script type="svelte-data" url="${url}">${s(payload)}</script>`).join("\n\n			")}
		`.replace(/^\t{2}/gm, "");
  const headers = {
    "content-type": "text/html"
  };
  if (maxage) {
    headers["cache-control"] = `${uses_credentials ? "private" : "public"}, max-age=${maxage}`;
  }
  return {
    status,
    headers,
    body: options.template({head: head2, body}),
    dependencies
  };
}
async function render_page(request2, route, options) {
  if (options.initiator === route) {
    return {
      status: 404,
      headers: {},
      body: `Not found: ${request2.path}`
    };
  }
  const $session = await options.hooks.getSession({context: request2.context});
  const response = await get_response({
    request: request2,
    options,
    $session,
    route,
    status: route ? 200 : 404,
    error: route ? null : new Error(`Not found: ${request2.path}`)
  });
  if (response) {
    return response;
  }
  if (options.fetched) {
    return {
      status: 500,
      headers: {},
      body: `Bad request in load function: failed to fetch ${options.fetched}`
    };
  }
}
function try_serialize(data2, fail) {
  try {
    return devalue(data2);
  } catch (err) {
    if (fail)
      fail(err);
    return null;
  }
}
function serialize_error(error2) {
  if (!error2)
    return null;
  let serialized = try_serialize(error2);
  if (!serialized) {
    const {name: name2, message, stack} = error2;
    serialized = try_serialize({name: name2, message, stack});
  }
  if (!serialized) {
    serialized = "{}";
  }
  return serialized;
}
async function render_route(request2, route) {
  const mod = await route.load();
  const handler = mod[request2.method.toLowerCase().replace("delete", "del")];
  if (handler) {
    const match2 = route.pattern.exec(request2.path);
    const params = route.params(match2);
    const response = await handler({...request2, params});
    if (response) {
      if (typeof response !== "object" || response.body == null) {
        return {
          status: 500,
          body: `Invalid response from route ${request2.path}; ${response.body == null ? "body is missing" : `expected an object, got ${typeof response}`}`,
          headers: {}
        };
      }
      let {status = 200, body, headers = {}} = response;
      headers = lowercase_keys(headers);
      if (typeof body === "object" && !("content-type" in headers) || headers["content-type"] === "application/json") {
        headers = {...headers, "content-type": "application/json"};
        body = JSON.stringify(body);
      }
      return {status, body, headers};
    }
  }
}
function lowercase_keys(obj) {
  const clone2 = {};
  for (const key in obj) {
    clone2[key.toLowerCase()] = obj[key];
  }
  return clone2;
}
function md5(body) {
  return createHash("md5").update(body).digest("hex");
}
async function ssr(incoming, options) {
  if (incoming.path.endsWith("/") && incoming.path !== "/") {
    const q = incoming.query.toString();
    return {
      status: 301,
      headers: {
        location: incoming.path.slice(0, -1) + (q ? `?${q}` : "")
      }
    };
  }
  const context = await options.hooks.getContext(incoming) || {};
  try {
    return await options.hooks.handle({
      ...incoming,
      params: null,
      context
    }, async (request2) => {
      for (const route of options.manifest.routes) {
        if (!route.pattern.test(request2.path))
          continue;
        const response = route.type === "endpoint" ? await render_route(request2, route) : await render_page(request2, route, options);
        if (response) {
          if (response.status === 200) {
            if (!/(no-store|immutable)/.test(response.headers["cache-control"])) {
              const etag = `"${md5(response.body)}"`;
              if (request2.headers["if-none-match"] === etag) {
                return {
                  status: 304,
                  headers: {},
                  body: null
                };
              }
              response.headers["etag"] = etag;
            }
          }
          return response;
        }
      }
      return await render_page(request2, null, options);
    });
  } catch (e) {
    if (e && e.stack) {
      e.stack = await options.get_stack(e);
    }
    console.error(e && e.stack || e);
    return {
      status: 500,
      headers: {},
      body: options.dev ? e.stack : e.message
    };
  }
}
function noop() {
}
function run$1(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run$1);
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function subscribe(store2, ...callbacks) {
  if (store2 == null) {
    return noop;
  }
  const unsub = store2.subscribe(...callbacks);
  return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function null_to_empty(value) {
  return value == null ? "" : value;
}
function set_store_value(store2, ret, value = ret) {
  store2.set(value);
  return ret;
}
function custom_event(type, detail) {
  const e = document.createEvent("CustomEvent");
  e.initCustomEvent(type, false, false, detail);
  return e;
}
let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
  get_current_component().$$.after_update.push(fn);
}
function createEventDispatcher() {
  const component = get_current_component();
  return (type, detail) => {
    const callbacks = component.$$.callbacks[type];
    if (callbacks) {
      const event = custom_event(type, detail);
      callbacks.slice().forEach((fn) => {
        fn.call(component, event);
      });
    }
  };
}
function setContext(key, context) {
  get_current_component().$$.context.set(key, context);
}
function getContext(key) {
  return get_current_component().$$.context.get(key);
}
const escaped = {
  '"': "&quot;",
  "'": "&#39;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};
function escape(html2) {
  return String(html2).replace(/["'&<>]/g, (match2) => escaped[match2]);
}
function each(items, fn) {
  let str = "";
  for (let i = 0; i < items.length; i += 1) {
    str += fn(items[i], i);
  }
  return str;
}
const missing_component = {
  $$render: () => ""
};
function validate_component(component, name2) {
  if (!component || !component.$$render) {
    if (name2 === "svelte:component")
      name2 += " this={...}";
    throw new Error(`<${name2}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
  }
  return component;
}
let on_destroy;
function create_ssr_component(fn) {
  function $$render(result, props, bindings, slots, context) {
    const parent_component = current_component;
    const $$ = {
      on_destroy,
      context: new Map(parent_component ? parent_component.$$.context : context || []),
      on_mount: [],
      before_update: [],
      after_update: [],
      callbacks: blank_object()
    };
    set_current_component({$$});
    const html2 = fn(result, props, bindings, slots);
    set_current_component(parent_component);
    return html2;
  }
  return {
    render: (props = {}, {$$slots = {}, context = new Map()} = {}) => {
      on_destroy = [];
      const result = {title: "", head: "", css: new Set()};
      const html2 = $$render(result, props, {}, $$slots, context);
      run_all(on_destroy);
      return {
        html: html2,
        css: {
          code: Array.from(result.css).map((css2) => css2.code).join("\n"),
          map: null
        },
        head: result.title + result.head
      };
    },
    $$render
  };
}
const Error$1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {status} = $$props;
  let {error: error2} = $$props;
  if ($$props.status === void 0 && $$bindings.status && status !== void 0)
    $$bindings.status(status);
  if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
    $$bindings.error(error2);
  return `<h1>${escape(status)}</h1>

<p>${escape(error2.message)}</p>


${error2.stack ? `<pre>${escape(error2.stack)}</pre>` : ``}`;
});
var error = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Error$1
});
var root_svelte = "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}";
const css$6 = {
  code: "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}",
  map: `{"version":3,"file":"root.svelte","sources":["root.svelte"],"sourcesContent":["<!-- This file is generated by @sveltejs/kit \u2014 do not edit it! -->\\n<script>\\n\\timport { setContext, afterUpdate, onMount } from 'svelte';\\n\\timport ErrorComponent from \\"..\\\\\\\\components\\\\\\\\error.svelte\\";\\n\\n\\t// error handling\\n\\texport let status = undefined;\\n\\texport let error = undefined;\\n\\n\\t// stores\\n\\texport let stores;\\n\\texport let page;\\n\\n\\texport let components;\\n\\texport let props_0 = null;\\n\\texport let props_1 = null;\\n\\n\\tconst Layout = components[0];\\n\\n\\tsetContext('__svelte__', stores);\\n\\n\\t$: stores.page.set(page);\\n\\tafterUpdate(stores.page.notify);\\n\\n\\tlet mounted = false;\\n\\tlet navigated = false;\\n\\tlet title = null;\\n\\n\\tonMount(() => {\\n\\t\\tconst unsubscribe = stores.page.subscribe(() => {\\n\\t\\t\\tif (mounted) {\\n\\t\\t\\t\\tnavigated = true;\\n\\t\\t\\t\\ttitle = document.title;\\n\\t\\t\\t}\\n\\t\\t});\\n\\n\\t\\tmounted = true;\\n\\t\\treturn unsubscribe;\\n\\t});\\n</script>\\n\\n<Layout {...(props_0 || {})}>\\n\\t{#if error}\\n\\t\\t<ErrorComponent {status} {error}/>\\n\\t{:else}\\n\\t\\t<svelte:component this={components[1]} {...(props_1 || {})}/>\\n\\t{/if}\\n</Layout>\\n\\n{#if mounted}\\n\\t<div id=\\"svelte-announcer\\" aria-live=\\"assertive\\" aria-atomic=\\"true\\">\\n\\t\\t{#if navigated}\\n\\t\\t\\tNavigated to {title}\\n\\t\\t{/if}\\n\\t</div>\\n{/if}\\n\\n<style>\\n\\t#svelte-announcer {\\n\\t\\tposition: absolute;\\n\\t\\tleft: 0;\\n\\t\\ttop: 0;\\n\\t\\tclip: rect(0 0 0 0);\\n\\t\\tclip-path: inset(50%);\\n\\t\\toverflow: hidden;\\n\\t\\twhite-space: nowrap;\\n\\t\\twidth: 1px;\\n\\t\\theight: 1px;\\n\\t}\\n</style>"],"names":[],"mappings":"AA0DC,iBAAiB,eAAC,CAAC,AAClB,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CAAC,CACP,GAAG,CAAE,CAAC,CACN,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CACnB,SAAS,CAAE,MAAM,GAAG,CAAC,CACrB,QAAQ,CAAE,MAAM,CAChB,WAAW,CAAE,MAAM,CACnB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,AACZ,CAAC"}`
};
const Root = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {status = void 0} = $$props;
  let {error: error2 = void 0} = $$props;
  let {stores} = $$props;
  let {page} = $$props;
  let {components: components2} = $$props;
  let {props_0 = null} = $$props;
  let {props_1 = null} = $$props;
  const Layout = components2[0];
  setContext("__svelte__", stores);
  afterUpdate(stores.page.notify);
  let mounted = false;
  let navigated = false;
  let title = null;
  onMount(() => {
    const unsubscribe = stores.page.subscribe(() => {
      if (mounted) {
        navigated = true;
        title = document.title;
      }
    });
    mounted = true;
    return unsubscribe;
  });
  if ($$props.status === void 0 && $$bindings.status && status !== void 0)
    $$bindings.status(status);
  if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
    $$bindings.error(error2);
  if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0)
    $$bindings.stores(stores);
  if ($$props.page === void 0 && $$bindings.page && page !== void 0)
    $$bindings.page(page);
  if ($$props.components === void 0 && $$bindings.components && components2 !== void 0)
    $$bindings.components(components2);
  if ($$props.props_0 === void 0 && $$bindings.props_0 && props_0 !== void 0)
    $$bindings.props_0(props_0);
  if ($$props.props_1 === void 0 && $$bindings.props_1 && props_1 !== void 0)
    $$bindings.props_1(props_1);
  $$result.css.add(css$6);
  {
    stores.page.set(page);
  }
  return `


${validate_component(Layout, "Layout").$$render($$result, Object.assign(props_0 || {}), {}, {
    default: () => `${error2 ? `${validate_component(Error$1, "ErrorComponent").$$render($$result, {status, error: error2}, {}, {})}` : `${validate_component(components2[1] || missing_component, "svelte:component").$$render($$result, Object.assign(props_1 || {}), {}, {})}`}`
  })}

${mounted ? `<div id="${"svelte-announcer"}" aria-live="${"assertive"}" aria-atomic="${"true"}" class="${"svelte-1j55zn5"}">${navigated ? `Navigated to ${escape(title)}` : ``}</div>` : ``}`;
});
var user_hooks = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module"
});
const template = ({head: head2, body}) => '<!DOCTYPE html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<link rel="icon" href="/favicon.ico" />\n		<meta name="viewport" content="width=device-width, initial-scale=1" />\n		' + head2 + '\n	</head>\n	<body>\n		<div id="svelte" style="position: relative; height: 100%;" >' + body + "</div>\n	</body>\n</html>\n";
function init({paths}) {
}
const d = decodeURIComponent;
const empty = () => ({});
const components = [
  () => Promise.resolve().then(function() {
    return index;
  }),
  () => Promise.resolve().then(function() {
    return mainSite;
  }),
  () => Promise.resolve().then(function() {
    return contact;
  }),
  () => Promise.resolve().then(function() {
    return about;
  }),
  () => Promise.resolve().then(function() {
    return _slug_;
  })
];
const client_component_lookup = {".svelte/build/runtime/internal/start.js": "start-06962a62.js", "src/routes/index.svelte": "pages\\index.svelte-750cdb38.js", "src/routes/mainSite.svelte": "pages\\mainSite.svelte-4ec1a767.js", "src/routes/contact.svelte": "pages\\contact.svelte-1cd4b86e.js", "src/routes/about.svelte": "pages\\about.svelte-effcaed0.js", "src/routes/posts/[slug].svelte": "pages\\posts\\[slug].svelte-bbbe1be7.js"};
const manifest = {
  assets: [{file: "favicon.ico", size: 1150, type: "image/vnd.microsoft.icon"}, {file: "robots.txt", size: 67, type: "text/plain"}],
  layout: () => Promise.resolve().then(function() {
    return $layout$1;
  }),
  error: () => Promise.resolve().then(function() {
    return error;
  }),
  routes: [
    {
      type: "page",
      pattern: /^\/$/,
      params: empty,
      parts: [{id: "src/routes/index.svelte", load: components[0]}],
      css: ["assets/start-7e5f45fa.css", "assets/pages\\index.svelte-aa263bb9.css"],
      js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\index.svelte-750cdb38.js", "chunks/content-api-d1f47f42.js"]
    },
    {
      type: "page",
      pattern: /^\/mainSite\/?$/,
      params: empty,
      parts: [{id: "src/routes/mainSite.svelte", load: components[1]}],
      css: ["assets/start-7e5f45fa.css"],
      js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\mainSite.svelte-4ec1a767.js"]
    },
    {
      type: "page",
      pattern: /^\/contact\/?$/,
      params: empty,
      parts: [{id: "src/routes/contact.svelte", load: components[2]}],
      css: ["assets/start-7e5f45fa.css"],
      js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\contact.svelte-1cd4b86e.js"]
    },
    {
      type: "page",
      pattern: /^\/about\/?$/,
      params: empty,
      parts: [{id: "src/routes/about.svelte", load: components[3]}],
      css: ["assets/start-7e5f45fa.css"],
      js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\about.svelte-effcaed0.js"]
    },
    {
      type: "page",
      pattern: /^\/posts\/([^/]+?)\/?$/,
      params: (m) => ({slug: d(m[1])}),
      parts: [{id: "src/routes/posts/[slug].svelte", load: components[4]}],
      css: ["assets/start-7e5f45fa.css", "assets/pages\\posts\\[slug].svelte-4c5b6620.css"],
      js: ["start-06962a62.js", "chunks/index-61bdb035.js", "chunks/index-5f559568.js", "pages\\posts\\[slug].svelte-bbbe1be7.js", "chunks/content-api-d1f47f42.js"]
    }
  ]
};
const get_hooks = (hooks2) => ({
  getContext: hooks2.getContext || (() => ({})),
  getSession: hooks2.getSession || (() => ({})),
  handle: hooks2.handle || ((request2, render2) => render2(request2))
});
const hooks = get_hooks(user_hooks);
function render(request2, {
  paths = {base: "", assets: "/."},
  local = false,
  only_render_prerenderable_pages = false,
  get_static_file
} = {}) {
  return ssr({
    ...request2,
    host: request2.headers["host"]
  }, {
    paths,
    local,
    template,
    manifest,
    target: "#svelte",
    entry: "/./_app/start-06962a62.js",
    root: Root,
    hooks,
    dev: false,
    amp: false,
    only_render_prerenderable_pages,
    app_dir: "_app",
    get_component_path: (id2) => "/./_app/" + client_component_lookup[id2],
    get_stack: (error2) => error2.stack,
    get_static_file,
    get_amp_css: (dep) => amp_css_lookup[dep],
    ssr: true,
    router: true,
    hydrate: true
  });
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function createCommonjsModule(fn, module) {
  return module = {exports: {}}, fn(module, module.exports), module.exports;
}
var check = function(it) {
  return it && it.Math == Math && it;
};
var global_1 = check(typeof globalThis == "object" && globalThis) || check(typeof window == "object" && window) || check(typeof self == "object" && self) || check(typeof commonjsGlobal == "object" && commonjsGlobal) || function() {
  return this;
}() || Function("return this")();
var fails = function(exec) {
  try {
    return !!exec();
  } catch (error2) {
    return true;
  }
};
var descriptors = !fails(function() {
  return Object.defineProperty({}, 1, {get: function() {
    return 7;
  }})[1] != 7;
});
var nativePropertyIsEnumerable = {}.propertyIsEnumerable;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var NASHORN_BUG = getOwnPropertyDescriptor && !nativePropertyIsEnumerable.call({1: 2}, 1);
var f = NASHORN_BUG ? function propertyIsEnumerable(V) {
  var descriptor = getOwnPropertyDescriptor(this, V);
  return !!descriptor && descriptor.enumerable;
} : nativePropertyIsEnumerable;
var objectPropertyIsEnumerable = {
  f
};
var createPropertyDescriptor = function(bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value
  };
};
var toString = {}.toString;
var classofRaw = function(it) {
  return toString.call(it).slice(8, -1);
};
var split = "".split;
var indexedObject = fails(function() {
  return !Object("z").propertyIsEnumerable(0);
}) ? function(it) {
  return classofRaw(it) == "String" ? split.call(it, "") : Object(it);
} : Object;
var requireObjectCoercible = function(it) {
  if (it == void 0)
    throw TypeError("Can't call method on " + it);
  return it;
};
var toIndexedObject = function(it) {
  return indexedObject(requireObjectCoercible(it));
};
var isObject = function(it) {
  return typeof it === "object" ? it !== null : typeof it === "function";
};
var toPrimitive = function(input, PREFERRED_STRING) {
  if (!isObject(input))
    return input;
  var fn, val;
  if (PREFERRED_STRING && typeof (fn = input.toString) == "function" && !isObject(val = fn.call(input)))
    return val;
  if (typeof (fn = input.valueOf) == "function" && !isObject(val = fn.call(input)))
    return val;
  if (!PREFERRED_STRING && typeof (fn = input.toString) == "function" && !isObject(val = fn.call(input)))
    return val;
  throw TypeError("Can't convert object to primitive value");
};
var hasOwnProperty = {}.hasOwnProperty;
var has = function(it, key) {
  return hasOwnProperty.call(it, key);
};
var document$1 = global_1.document;
var EXISTS = isObject(document$1) && isObject(document$1.createElement);
var documentCreateElement = function(it) {
  return EXISTS ? document$1.createElement(it) : {};
};
var ie8DomDefine = !descriptors && !fails(function() {
  return Object.defineProperty(documentCreateElement("div"), "a", {
    get: function() {
      return 7;
    }
  }).a != 7;
});
var nativeGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var f$1 = descriptors ? nativeGetOwnPropertyDescriptor : function getOwnPropertyDescriptor2(O, P) {
  O = toIndexedObject(O);
  P = toPrimitive(P, true);
  if (ie8DomDefine)
    try {
      return nativeGetOwnPropertyDescriptor(O, P);
    } catch (error2) {
    }
  if (has(O, P))
    return createPropertyDescriptor(!objectPropertyIsEnumerable.f.call(O, P), O[P]);
};
var objectGetOwnPropertyDescriptor = {
  f: f$1
};
var anObject = function(it) {
  if (!isObject(it)) {
    throw TypeError(String(it) + " is not an object");
  }
  return it;
};
var nativeDefineProperty = Object.defineProperty;
var f$2 = descriptors ? nativeDefineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (ie8DomDefine)
    try {
      return nativeDefineProperty(O, P, Attributes);
    } catch (error2) {
    }
  if ("get" in Attributes || "set" in Attributes)
    throw TypeError("Accessors not supported");
  if ("value" in Attributes)
    O[P] = Attributes.value;
  return O;
};
var objectDefineProperty = {
  f: f$2
};
var createNonEnumerableProperty = descriptors ? function(object, key, value) {
  return objectDefineProperty.f(object, key, createPropertyDescriptor(1, value));
} : function(object, key, value) {
  object[key] = value;
  return object;
};
var setGlobal = function(key, value) {
  try {
    createNonEnumerableProperty(global_1, key, value);
  } catch (error2) {
    global_1[key] = value;
  }
  return value;
};
var SHARED = "__core-js_shared__";
var store = global_1[SHARED] || setGlobal(SHARED, {});
var sharedStore = store;
var functionToString = Function.toString;
if (typeof sharedStore.inspectSource != "function") {
  sharedStore.inspectSource = function(it) {
    return functionToString.call(it);
  };
}
var inspectSource = sharedStore.inspectSource;
var WeakMap$1 = global_1.WeakMap;
var nativeWeakMap = typeof WeakMap$1 === "function" && /native code/.test(inspectSource(WeakMap$1));
var shared = createCommonjsModule(function(module) {
  (module.exports = function(key, value) {
    return sharedStore[key] || (sharedStore[key] = value !== void 0 ? value : {});
  })("versions", []).push({
    version: "3.7.0",
    mode: "global",
    copyright: "\xA9 2020 Denis Pushkarev (zloirock.ru)"
  });
});
var id = 0;
var postfix = Math.random();
var uid = function(key) {
  return "Symbol(" + String(key === void 0 ? "" : key) + ")_" + (++id + postfix).toString(36);
};
var keys = shared("keys");
var sharedKey = function(key) {
  return keys[key] || (keys[key] = uid(key));
};
var hiddenKeys = {};
var WeakMap$1$1 = global_1.WeakMap;
var set, get, has$1;
var enforce = function(it) {
  return has$1(it) ? get(it) : set(it, {});
};
var getterFor = function(TYPE) {
  return function(it) {
    var state;
    if (!isObject(it) || (state = get(it)).type !== TYPE) {
      throw TypeError("Incompatible receiver, " + TYPE + " required");
    }
    return state;
  };
};
if (nativeWeakMap) {
  var store$1 = sharedStore.state || (sharedStore.state = new WeakMap$1$1());
  var wmget = store$1.get;
  var wmhas = store$1.has;
  var wmset = store$1.set;
  set = function(it, metadata) {
    metadata.facade = it;
    wmset.call(store$1, it, metadata);
    return metadata;
  };
  get = function(it) {
    return wmget.call(store$1, it) || {};
  };
  has$1 = function(it) {
    return wmhas.call(store$1, it);
  };
} else {
  var STATE = sharedKey("state");
  hiddenKeys[STATE] = true;
  set = function(it, metadata) {
    metadata.facade = it;
    createNonEnumerableProperty(it, STATE, metadata);
    return metadata;
  };
  get = function(it) {
    return has(it, STATE) ? it[STATE] : {};
  };
  has$1 = function(it) {
    return has(it, STATE);
  };
}
var internalState = {
  set,
  get,
  has: has$1,
  enforce,
  getterFor
};
var redefine = createCommonjsModule(function(module) {
  var getInternalState2 = internalState.get;
  var enforceInternalState = internalState.enforce;
  var TEMPLATE = String(String).split("String");
  (module.exports = function(O, key, value, options) {
    var unsafe = options ? !!options.unsafe : false;
    var simple = options ? !!options.enumerable : false;
    var noTargetGet = options ? !!options.noTargetGet : false;
    var state;
    if (typeof value == "function") {
      if (typeof key == "string" && !has(value, "name")) {
        createNonEnumerableProperty(value, "name", key);
      }
      state = enforceInternalState(value);
      if (!state.source) {
        state.source = TEMPLATE.join(typeof key == "string" ? key : "");
      }
    }
    if (O === global_1) {
      if (simple)
        O[key] = value;
      else
        setGlobal(key, value);
      return;
    } else if (!unsafe) {
      delete O[key];
    } else if (!noTargetGet && O[key]) {
      simple = true;
    }
    if (simple)
      O[key] = value;
    else
      createNonEnumerableProperty(O, key, value);
  })(Function.prototype, "toString", function toString4() {
    return typeof this == "function" && getInternalState2(this).source || inspectSource(this);
  });
});
var path = global_1;
var aFunction = function(variable) {
  return typeof variable == "function" ? variable : void 0;
};
var getBuiltIn = function(namespace, method) {
  return arguments.length < 2 ? aFunction(path[namespace]) || aFunction(global_1[namespace]) : path[namespace] && path[namespace][method] || global_1[namespace] && global_1[namespace][method];
};
var ceil = Math.ceil;
var floor = Math.floor;
var toInteger = function(argument) {
  return isNaN(argument = +argument) ? 0 : (argument > 0 ? floor : ceil)(argument);
};
var min = Math.min;
var toLength = function(argument) {
  return argument > 0 ? min(toInteger(argument), 9007199254740991) : 0;
};
var max = Math.max;
var min$1 = Math.min;
var toAbsoluteIndex = function(index2, length) {
  var integer = toInteger(index2);
  return integer < 0 ? max(integer + length, 0) : min$1(integer, length);
};
var createMethod = function(IS_INCLUDES) {
  return function($this, el, fromIndex) {
    var O = toIndexedObject($this);
    var length = toLength(O.length);
    var index2 = toAbsoluteIndex(fromIndex, length);
    var value;
    if (IS_INCLUDES && el != el)
      while (length > index2) {
        value = O[index2++];
        if (value != value)
          return true;
      }
    else
      for (; length > index2; index2++) {
        if ((IS_INCLUDES || index2 in O) && O[index2] === el)
          return IS_INCLUDES || index2 || 0;
      }
    return !IS_INCLUDES && -1;
  };
};
var arrayIncludes = {
  includes: createMethod(true),
  indexOf: createMethod(false)
};
var indexOf = arrayIncludes.indexOf;
var objectKeysInternal = function(object, names) {
  var O = toIndexedObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O)
    !has(hiddenKeys, key) && has(O, key) && result.push(key);
  while (names.length > i)
    if (has(O, key = names[i++])) {
      ~indexOf(result, key) || result.push(key);
    }
  return result;
};
var enumBugKeys = [
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf"
];
var hiddenKeys$1 = enumBugKeys.concat("length", "prototype");
var f$3 = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return objectKeysInternal(O, hiddenKeys$1);
};
var objectGetOwnPropertyNames = {
  f: f$3
};
var f$4 = Object.getOwnPropertySymbols;
var objectGetOwnPropertySymbols = {
  f: f$4
};
var ownKeys = getBuiltIn("Reflect", "ownKeys") || function ownKeys2(it) {
  var keys4 = objectGetOwnPropertyNames.f(anObject(it));
  var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
  return getOwnPropertySymbols ? keys4.concat(getOwnPropertySymbols(it)) : keys4;
};
var copyConstructorProperties = function(target, source2) {
  var keys4 = ownKeys(source2);
  var defineProperty3 = objectDefineProperty.f;
  var getOwnPropertyDescriptor3 = objectGetOwnPropertyDescriptor.f;
  for (var i = 0; i < keys4.length; i++) {
    var key = keys4[i];
    if (!has(target, key))
      defineProperty3(target, key, getOwnPropertyDescriptor3(source2, key));
  }
};
var replacement = /#|\.prototype\./;
var isForced = function(feature, detection) {
  var value = data[normalize(feature)];
  return value == POLYFILL ? true : value == NATIVE ? false : typeof detection == "function" ? fails(detection) : !!detection;
};
var normalize = isForced.normalize = function(string) {
  return String(string).replace(replacement, ".").toLowerCase();
};
var data = isForced.data = {};
var NATIVE = isForced.NATIVE = "N";
var POLYFILL = isForced.POLYFILL = "P";
var isForced_1 = isForced;
var getOwnPropertyDescriptor$1 = objectGetOwnPropertyDescriptor.f;
var _export = function(options, source2) {
  var TARGET = options.target;
  var GLOBAL = options.global;
  var STATIC = options.stat;
  var FORCED2, target, key, targetProperty, sourceProperty, descriptor;
  if (GLOBAL) {
    target = global_1;
  } else if (STATIC) {
    target = global_1[TARGET] || setGlobal(TARGET, {});
  } else {
    target = (global_1[TARGET] || {}).prototype;
  }
  if (target)
    for (key in source2) {
      sourceProperty = source2[key];
      if (options.noTargetGet) {
        descriptor = getOwnPropertyDescriptor$1(target, key);
        targetProperty = descriptor && descriptor.value;
      } else
        targetProperty = target[key];
      FORCED2 = isForced_1(GLOBAL ? key : TARGET + (STATIC ? "." : "#") + key, options.forced);
      if (!FORCED2 && targetProperty !== void 0) {
        if (typeof sourceProperty === typeof targetProperty)
          continue;
        copyConstructorProperties(sourceProperty, targetProperty);
      }
      if (options.sham || targetProperty && targetProperty.sham) {
        createNonEnumerableProperty(sourceProperty, "sham", true);
      }
      redefine(target, key, sourceProperty, options);
    }
};
var isArray = Array.isArray || function isArray2(arg) {
  return classofRaw(arg) == "Array";
};
var toObject = function(argument) {
  return Object(requireObjectCoercible(argument));
};
var createProperty = function(object, key, value) {
  var propertyKey = toPrimitive(key);
  if (propertyKey in object)
    objectDefineProperty.f(object, propertyKey, createPropertyDescriptor(0, value));
  else
    object[propertyKey] = value;
};
var nativeSymbol = !!Object.getOwnPropertySymbols && !fails(function() {
  return !String(Symbol());
});
var useSymbolAsUid = nativeSymbol && !Symbol.sham && typeof Symbol.iterator == "symbol";
var WellKnownSymbolsStore = shared("wks");
var Symbol$1 = global_1.Symbol;
var createWellKnownSymbol = useSymbolAsUid ? Symbol$1 : Symbol$1 && Symbol$1.withoutSetter || uid;
var wellKnownSymbol = function(name2) {
  if (!has(WellKnownSymbolsStore, name2)) {
    if (nativeSymbol && has(Symbol$1, name2))
      WellKnownSymbolsStore[name2] = Symbol$1[name2];
    else
      WellKnownSymbolsStore[name2] = createWellKnownSymbol("Symbol." + name2);
  }
  return WellKnownSymbolsStore[name2];
};
var SPECIES = wellKnownSymbol("species");
var arraySpeciesCreate = function(originalArray, length) {
  var C;
  if (isArray(originalArray)) {
    C = originalArray.constructor;
    if (typeof C == "function" && (C === Array || isArray(C.prototype)))
      C = void 0;
    else if (isObject(C)) {
      C = C[SPECIES];
      if (C === null)
        C = void 0;
    }
  }
  return new (C === void 0 ? Array : C)(length === 0 ? 0 : length);
};
var engineUserAgent = getBuiltIn("navigator", "userAgent") || "";
var process$1 = global_1.process;
var versions = process$1 && process$1.versions;
var v8 = versions && versions.v8;
var match, version;
if (v8) {
  match = v8.split(".");
  version = match[0] + match[1];
} else if (engineUserAgent) {
  match = engineUserAgent.match(/Edge\/(\d+)/);
  if (!match || match[1] >= 74) {
    match = engineUserAgent.match(/Chrome\/(\d+)/);
    if (match)
      version = match[1];
  }
}
var engineV8Version = version && +version;
var SPECIES$1 = wellKnownSymbol("species");
var arrayMethodHasSpeciesSupport = function(METHOD_NAME) {
  return engineV8Version >= 51 || !fails(function() {
    var array = [];
    var constructor = array.constructor = {};
    constructor[SPECIES$1] = function() {
      return {foo: 1};
    };
    return array[METHOD_NAME](Boolean).foo !== 1;
  });
};
var IS_CONCAT_SPREADABLE = wellKnownSymbol("isConcatSpreadable");
var MAX_SAFE_INTEGER = 9007199254740991;
var MAXIMUM_ALLOWED_INDEX_EXCEEDED = "Maximum allowed index exceeded";
var IS_CONCAT_SPREADABLE_SUPPORT = engineV8Version >= 51 || !fails(function() {
  var array = [];
  array[IS_CONCAT_SPREADABLE] = false;
  return array.concat()[0] !== array;
});
var SPECIES_SUPPORT = arrayMethodHasSpeciesSupport("concat");
var isConcatSpreadable = function(O) {
  if (!isObject(O))
    return false;
  var spreadable = O[IS_CONCAT_SPREADABLE];
  return spreadable !== void 0 ? !!spreadable : isArray(O);
};
var FORCED = !IS_CONCAT_SPREADABLE_SUPPORT || !SPECIES_SUPPORT;
_export({target: "Array", proto: true, forced: FORCED}, {
  concat: function concat(arg) {
    var O = toObject(this);
    var A = arraySpeciesCreate(O, 0);
    var n = 0;
    var i, k, length, len, E;
    for (i = -1, length = arguments.length; i < length; i++) {
      E = i === -1 ? O : arguments[i];
      if (isConcatSpreadable(E)) {
        len = toLength(E.length);
        if (n + len > MAX_SAFE_INTEGER)
          throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
        for (k = 0; k < len; k++, n++)
          if (k in E)
            createProperty(A, n, E[k]);
      } else {
        if (n >= MAX_SAFE_INTEGER)
          throw TypeError(MAXIMUM_ALLOWED_INDEX_EXCEEDED);
        createProperty(A, n++, E);
      }
    }
    A.length = n;
    return A;
  }
});
var aFunction$1 = function(it) {
  if (typeof it != "function") {
    throw TypeError(String(it) + " is not a function");
  }
  return it;
};
var functionBindContext = function(fn, that, length) {
  aFunction$1(fn);
  if (that === void 0)
    return fn;
  switch (length) {
    case 0:
      return function() {
        return fn.call(that);
      };
    case 1:
      return function(a) {
        return fn.call(that, a);
      };
    case 2:
      return function(a, b) {
        return fn.call(that, a, b);
      };
    case 3:
      return function(a, b, c) {
        return fn.call(that, a, b, c);
      };
  }
  return function() {
    return fn.apply(that, arguments);
  };
};
var push = [].push;
var createMethod$1 = function(TYPE) {
  var IS_MAP = TYPE == 1;
  var IS_FILTER = TYPE == 2;
  var IS_SOME = TYPE == 3;
  var IS_EVERY = TYPE == 4;
  var IS_FIND_INDEX = TYPE == 6;
  var NO_HOLES = TYPE == 5 || IS_FIND_INDEX;
  return function($this, callbackfn, that, specificCreate) {
    var O = toObject($this);
    var self2 = indexedObject(O);
    var boundFunction = functionBindContext(callbackfn, that, 3);
    var length = toLength(self2.length);
    var index2 = 0;
    var create3 = specificCreate || arraySpeciesCreate;
    var target = IS_MAP ? create3($this, length) : IS_FILTER ? create3($this, 0) : void 0;
    var value, result;
    for (; length > index2; index2++)
      if (NO_HOLES || index2 in self2) {
        value = self2[index2];
        result = boundFunction(value, index2, O);
        if (TYPE) {
          if (IS_MAP)
            target[index2] = result;
          else if (result)
            switch (TYPE) {
              case 3:
                return true;
              case 5:
                return value;
              case 6:
                return index2;
              case 2:
                push.call(target, value);
            }
          else if (IS_EVERY)
            return false;
        }
      }
    return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : target;
  };
};
var arrayIteration = {
  forEach: createMethod$1(0),
  map: createMethod$1(1),
  filter: createMethod$1(2),
  some: createMethod$1(3),
  every: createMethod$1(4),
  find: createMethod$1(5),
  findIndex: createMethod$1(6)
};
var arrayMethodIsStrict = function(METHOD_NAME, argument) {
  var method = [][METHOD_NAME];
  return !!method && fails(function() {
    method.call(null, argument || function() {
      throw 1;
    }, 1);
  });
};
var defineProperty2 = Object.defineProperty;
var cache = {};
var thrower = function(it) {
  throw it;
};
var arrayMethodUsesToLength = function(METHOD_NAME, options) {
  if (has(cache, METHOD_NAME))
    return cache[METHOD_NAME];
  if (!options)
    options = {};
  var method = [][METHOD_NAME];
  var ACCESSORS = has(options, "ACCESSORS") ? options.ACCESSORS : false;
  var argument0 = has(options, 0) ? options[0] : thrower;
  var argument1 = has(options, 1) ? options[1] : void 0;
  return cache[METHOD_NAME] = !!method && !fails(function() {
    if (ACCESSORS && !descriptors)
      return true;
    var O = {length: -1};
    if (ACCESSORS)
      defineProperty2(O, 1, {enumerable: true, get: thrower});
    else
      O[1] = 1;
    method.call(O, argument0, argument1);
  });
};
var $forEach = arrayIteration.forEach;
var STRICT_METHOD = arrayMethodIsStrict("forEach");
var USES_TO_LENGTH = arrayMethodUsesToLength("forEach");
var arrayForEach = !STRICT_METHOD || !USES_TO_LENGTH ? function forEach(callbackfn) {
  return $forEach(this, callbackfn, arguments.length > 1 ? arguments[1] : void 0);
} : [].forEach;
_export({target: "Array", proto: true, forced: [].forEach != arrayForEach}, {
  forEach: arrayForEach
});
var objectKeys = Object.keys || function keys2(O) {
  return objectKeysInternal(O, enumBugKeys);
};
var objectDefineProperties = descriptors ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var keys4 = objectKeys(Properties);
  var length = keys4.length;
  var index2 = 0;
  var key;
  while (length > index2)
    objectDefineProperty.f(O, key = keys4[index2++], Properties[key]);
  return O;
};
var html = getBuiltIn("document", "documentElement");
var GT = ">";
var LT = "<";
var PROTOTYPE = "prototype";
var SCRIPT = "script";
var IE_PROTO = sharedKey("IE_PROTO");
var EmptyConstructor = function() {
};
var scriptTag = function(content) {
  return LT + SCRIPT + GT + content + LT + "/" + SCRIPT + GT;
};
var NullProtoObjectViaActiveX = function(activeXDocument2) {
  activeXDocument2.write(scriptTag(""));
  activeXDocument2.close();
  var temp = activeXDocument2.parentWindow.Object;
  activeXDocument2 = null;
  return temp;
};
var NullProtoObjectViaIFrame = function() {
  var iframe = documentCreateElement("iframe");
  var JS = "java" + SCRIPT + ":";
  var iframeDocument;
  iframe.style.display = "none";
  html.appendChild(iframe);
  iframe.src = String(JS);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(scriptTag("document.F=Object"));
  iframeDocument.close();
  return iframeDocument.F;
};
var activeXDocument;
var NullProtoObject = function() {
  try {
    activeXDocument = document.domain && new ActiveXObject("htmlfile");
  } catch (error2) {
  }
  NullProtoObject = activeXDocument ? NullProtoObjectViaActiveX(activeXDocument) : NullProtoObjectViaIFrame();
  var length = enumBugKeys.length;
  while (length--)
    delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
  return NullProtoObject();
};
hiddenKeys[IE_PROTO] = true;
var objectCreate = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    EmptyConstructor[PROTOTYPE] = anObject(O);
    result = new EmptyConstructor();
    EmptyConstructor[PROTOTYPE] = null;
    result[IE_PROTO] = O;
  } else
    result = NullProtoObject();
  return Properties === void 0 ? result : objectDefineProperties(result, Properties);
};
var UNSCOPABLES = wellKnownSymbol("unscopables");
var ArrayPrototype = Array.prototype;
if (ArrayPrototype[UNSCOPABLES] == void 0) {
  objectDefineProperty.f(ArrayPrototype, UNSCOPABLES, {
    configurable: true,
    value: objectCreate(null)
  });
}
var addToUnscopables = function(key) {
  ArrayPrototype[UNSCOPABLES][key] = true;
};
var $includes = arrayIncludes.includes;
var USES_TO_LENGTH$1 = arrayMethodUsesToLength("indexOf", {ACCESSORS: true, 1: 0});
_export({target: "Array", proto: true, forced: !USES_TO_LENGTH$1}, {
  includes: function includes(el) {
    return $includes(this, el, arguments.length > 1 ? arguments[1] : void 0);
  }
});
addToUnscopables("includes");
var nativeJoin = [].join;
var ES3_STRINGS = indexedObject != Object;
var STRICT_METHOD$1 = arrayMethodIsStrict("join", ",");
_export({target: "Array", proto: true, forced: ES3_STRINGS || !STRICT_METHOD$1}, {
  join: function join(separator) {
    return nativeJoin.call(toIndexedObject(this), separator === void 0 ? "," : separator);
  }
});
var createMethod$2 = function(IS_RIGHT) {
  return function(that, callbackfn, argumentsLength, memo) {
    aFunction$1(callbackfn);
    var O = toObject(that);
    var self2 = indexedObject(O);
    var length = toLength(O.length);
    var index2 = IS_RIGHT ? length - 1 : 0;
    var i = IS_RIGHT ? -1 : 1;
    if (argumentsLength < 2)
      while (true) {
        if (index2 in self2) {
          memo = self2[index2];
          index2 += i;
          break;
        }
        index2 += i;
        if (IS_RIGHT ? index2 < 0 : length <= index2) {
          throw TypeError("Reduce of empty array with no initial value");
        }
      }
    for (; IS_RIGHT ? index2 >= 0 : length > index2; index2 += i)
      if (index2 in self2) {
        memo = callbackfn(memo, self2[index2], index2, O);
      }
    return memo;
  };
};
var arrayReduce = {
  left: createMethod$2(false),
  right: createMethod$2(true)
};
var engineIsNode = classofRaw(global_1.process) == "process";
var $reduce = arrayReduce.left;
var STRICT_METHOD$2 = arrayMethodIsStrict("reduce");
var USES_TO_LENGTH$2 = arrayMethodUsesToLength("reduce", {1: 0});
var CHROME_BUG = !engineIsNode && engineV8Version > 79 && engineV8Version < 83;
_export({target: "Array", proto: true, forced: !STRICT_METHOD$2 || !USES_TO_LENGTH$2 || CHROME_BUG}, {
  reduce: function reduce(callbackfn) {
    return $reduce(this, callbackfn, arguments.length, arguments.length > 1 ? arguments[1] : void 0);
  }
});
var defineProperty$1 = objectDefineProperty.f;
var FunctionPrototype = Function.prototype;
var FunctionPrototypeToString = FunctionPrototype.toString;
var nameRE = /^\s*function ([^ (]*)/;
var NAME = "name";
if (descriptors && !(NAME in FunctionPrototype)) {
  defineProperty$1(FunctionPrototype, NAME, {
    configurable: true,
    get: function() {
      try {
        return FunctionPrototypeToString.call(this).match(nameRE)[1];
      } catch (error2) {
        return "";
      }
    }
  });
}
var nativeAssign = Object.assign;
var defineProperty$2 = Object.defineProperty;
var objectAssign = !nativeAssign || fails(function() {
  if (descriptors && nativeAssign({b: 1}, nativeAssign(defineProperty$2({}, "a", {
    enumerable: true,
    get: function() {
      defineProperty$2(this, "b", {
        value: 3,
        enumerable: false
      });
    }
  }), {b: 2})).b !== 1)
    return true;
  var A = {};
  var B = {};
  var symbol = Symbol();
  var alphabet = "abcdefghijklmnopqrst";
  A[symbol] = 7;
  alphabet.split("").forEach(function(chr) {
    B[chr] = chr;
  });
  return nativeAssign({}, A)[symbol] != 7 || objectKeys(nativeAssign({}, B)).join("") != alphabet;
}) ? function assign(target, source2) {
  var T = toObject(target);
  var argumentsLength = arguments.length;
  var index2 = 1;
  var getOwnPropertySymbols = objectGetOwnPropertySymbols.f;
  var propertyIsEnumerable2 = objectPropertyIsEnumerable.f;
  while (argumentsLength > index2) {
    var S = indexedObject(arguments[index2++]);
    var keys4 = getOwnPropertySymbols ? objectKeys(S).concat(getOwnPropertySymbols(S)) : objectKeys(S);
    var length = keys4.length;
    var j = 0;
    var key;
    while (length > j) {
      key = keys4[j++];
      if (!descriptors || propertyIsEnumerable2.call(S, key))
        T[key] = S[key];
    }
  }
  return T;
} : nativeAssign;
_export({target: "Object", stat: true, forced: Object.assign !== objectAssign}, {
  assign: objectAssign
});
var FAILS_ON_PRIMITIVES = fails(function() {
  objectKeys(1);
});
_export({target: "Object", stat: true, forced: FAILS_ON_PRIMITIVES}, {
  keys: function keys3(it) {
    return objectKeys(toObject(it));
  }
});
var TO_STRING_TAG = wellKnownSymbol("toStringTag");
var test = {};
test[TO_STRING_TAG] = "z";
var toStringTagSupport = String(test) === "[object z]";
var TO_STRING_TAG$1 = wellKnownSymbol("toStringTag");
var CORRECT_ARGUMENTS = classofRaw(function() {
  return arguments;
}()) == "Arguments";
var tryGet = function(it, key) {
  try {
    return it[key];
  } catch (error2) {
  }
};
var classof = toStringTagSupport ? classofRaw : function(it) {
  var O, tag, result;
  return it === void 0 ? "Undefined" : it === null ? "Null" : typeof (tag = tryGet(O = Object(it), TO_STRING_TAG$1)) == "string" ? tag : CORRECT_ARGUMENTS ? classofRaw(O) : (result = classofRaw(O)) == "Object" && typeof O.callee == "function" ? "Arguments" : result;
};
var objectToString = toStringTagSupport ? {}.toString : function toString2() {
  return "[object " + classof(this) + "]";
};
if (!toStringTagSupport) {
  redefine(Object.prototype, "toString", objectToString, {unsafe: true});
}
var nativePromiseConstructor = global_1.Promise;
var redefineAll = function(target, src2, options) {
  for (var key in src2)
    redefine(target, key, src2[key], options);
  return target;
};
var defineProperty$3 = objectDefineProperty.f;
var TO_STRING_TAG$2 = wellKnownSymbol("toStringTag");
var setToStringTag = function(it, TAG, STATIC) {
  if (it && !has(it = STATIC ? it : it.prototype, TO_STRING_TAG$2)) {
    defineProperty$3(it, TO_STRING_TAG$2, {configurable: true, value: TAG});
  }
};
var SPECIES$2 = wellKnownSymbol("species");
var setSpecies = function(CONSTRUCTOR_NAME) {
  var Constructor = getBuiltIn(CONSTRUCTOR_NAME);
  var defineProperty3 = objectDefineProperty.f;
  if (descriptors && Constructor && !Constructor[SPECIES$2]) {
    defineProperty3(Constructor, SPECIES$2, {
      configurable: true,
      get: function() {
        return this;
      }
    });
  }
};
var anInstance = function(it, Constructor, name2) {
  if (!(it instanceof Constructor)) {
    throw TypeError("Incorrect " + (name2 ? name2 + " " : "") + "invocation");
  }
  return it;
};
var iterators = {};
var ITERATOR = wellKnownSymbol("iterator");
var ArrayPrototype$1 = Array.prototype;
var isArrayIteratorMethod = function(it) {
  return it !== void 0 && (iterators.Array === it || ArrayPrototype$1[ITERATOR] === it);
};
var ITERATOR$1 = wellKnownSymbol("iterator");
var getIteratorMethod = function(it) {
  if (it != void 0)
    return it[ITERATOR$1] || it["@@iterator"] || iterators[classof(it)];
};
var iteratorClose = function(iterator) {
  var returnMethod = iterator["return"];
  if (returnMethod !== void 0) {
    return anObject(returnMethod.call(iterator)).value;
  }
};
var Result = function(stopped, result) {
  this.stopped = stopped;
  this.result = result;
};
var iterate = function(iterable, unboundFunction, options) {
  var that = options && options.that;
  var AS_ENTRIES = !!(options && options.AS_ENTRIES);
  var IS_ITERATOR = !!(options && options.IS_ITERATOR);
  var INTERRUPTED = !!(options && options.INTERRUPTED);
  var fn = functionBindContext(unboundFunction, that, 1 + AS_ENTRIES + INTERRUPTED);
  var iterator, iterFn, index2, length, result, next, step;
  var stop = function(condition) {
    if (iterator)
      iteratorClose(iterator);
    return new Result(true, condition);
  };
  var callFn = function(value) {
    if (AS_ENTRIES) {
      anObject(value);
      return INTERRUPTED ? fn(value[0], value[1], stop) : fn(value[0], value[1]);
    }
    return INTERRUPTED ? fn(value, stop) : fn(value);
  };
  if (IS_ITERATOR) {
    iterator = iterable;
  } else {
    iterFn = getIteratorMethod(iterable);
    if (typeof iterFn != "function")
      throw TypeError("Target is not iterable");
    if (isArrayIteratorMethod(iterFn)) {
      for (index2 = 0, length = toLength(iterable.length); length > index2; index2++) {
        result = callFn(iterable[index2]);
        if (result && result instanceof Result)
          return result;
      }
      return new Result(false);
    }
    iterator = iterFn.call(iterable);
  }
  next = iterator.next;
  while (!(step = next.call(iterator)).done) {
    try {
      result = callFn(step.value);
    } catch (error2) {
      iteratorClose(iterator);
      throw error2;
    }
    if (typeof result == "object" && result && result instanceof Result)
      return result;
  }
  return new Result(false);
};
var ITERATOR$2 = wellKnownSymbol("iterator");
var SAFE_CLOSING = false;
try {
  var called = 0;
  var iteratorWithReturn = {
    next: function() {
      return {done: !!called++};
    },
    return: function() {
      SAFE_CLOSING = true;
    }
  };
  iteratorWithReturn[ITERATOR$2] = function() {
    return this;
  };
  Array.from(iteratorWithReturn, function() {
    throw 2;
  });
} catch (error2) {
}
var checkCorrectnessOfIteration = function(exec, SKIP_CLOSING) {
  if (!SKIP_CLOSING && !SAFE_CLOSING)
    return false;
  var ITERATION_SUPPORT = false;
  try {
    var object = {};
    object[ITERATOR$2] = function() {
      return {
        next: function() {
          return {done: ITERATION_SUPPORT = true};
        }
      };
    };
    exec(object);
  } catch (error2) {
  }
  return ITERATION_SUPPORT;
};
var SPECIES$3 = wellKnownSymbol("species");
var speciesConstructor = function(O, defaultConstructor) {
  var C = anObject(O).constructor;
  var S;
  return C === void 0 || (S = anObject(C)[SPECIES$3]) == void 0 ? defaultConstructor : aFunction$1(S);
};
var engineIsIos = /(iphone|ipod|ipad).*applewebkit/i.test(engineUserAgent);
var location = global_1.location;
var set$1 = global_1.setImmediate;
var clear = global_1.clearImmediate;
var process$2 = global_1.process;
var MessageChannel = global_1.MessageChannel;
var Dispatch = global_1.Dispatch;
var counter = 0;
var queue = {};
var ONREADYSTATECHANGE = "onreadystatechange";
var defer, channel, port;
var run = function(id2) {
  if (queue.hasOwnProperty(id2)) {
    var fn = queue[id2];
    delete queue[id2];
    fn();
  }
};
var runner = function(id2) {
  return function() {
    run(id2);
  };
};
var listener = function(event) {
  run(event.data);
};
var post = function(id2) {
  global_1.postMessage(id2 + "", location.protocol + "//" + location.host);
};
if (!set$1 || !clear) {
  set$1 = function setImmediate(fn) {
    var args = [];
    var i = 1;
    while (arguments.length > i)
      args.push(arguments[i++]);
    queue[++counter] = function() {
      (typeof fn == "function" ? fn : Function(fn)).apply(void 0, args);
    };
    defer(counter);
    return counter;
  };
  clear = function clearImmediate(id2) {
    delete queue[id2];
  };
  if (engineIsNode) {
    defer = function(id2) {
      process$2.nextTick(runner(id2));
    };
  } else if (Dispatch && Dispatch.now) {
    defer = function(id2) {
      Dispatch.now(runner(id2));
    };
  } else if (MessageChannel && !engineIsIos) {
    channel = new MessageChannel();
    port = channel.port2;
    channel.port1.onmessage = listener;
    defer = functionBindContext(port.postMessage, port, 1);
  } else if (global_1.addEventListener && typeof postMessage == "function" && !global_1.importScripts && location && location.protocol !== "file:" && !fails(post)) {
    defer = post;
    global_1.addEventListener("message", listener, false);
  } else if (ONREADYSTATECHANGE in documentCreateElement("script")) {
    defer = function(id2) {
      html.appendChild(documentCreateElement("script"))[ONREADYSTATECHANGE] = function() {
        html.removeChild(this);
        run(id2);
      };
    };
  } else {
    defer = function(id2) {
      setTimeout(runner(id2), 0);
    };
  }
}
var task = {
  set: set$1,
  clear
};
var getOwnPropertyDescriptor$2 = objectGetOwnPropertyDescriptor.f;
var macrotask = task.set;
var MutationObserver = global_1.MutationObserver || global_1.WebKitMutationObserver;
var document$2 = global_1.document;
var process$3 = global_1.process;
var Promise$1 = global_1.Promise;
var queueMicrotaskDescriptor = getOwnPropertyDescriptor$2(global_1, "queueMicrotask");
var queueMicrotask = queueMicrotaskDescriptor && queueMicrotaskDescriptor.value;
var flush, head, last, notify, toggle, node, promise, then;
if (!queueMicrotask) {
  flush = function() {
    var parent, fn;
    if (engineIsNode && (parent = process$3.domain))
      parent.exit();
    while (head) {
      fn = head.fn;
      head = head.next;
      try {
        fn();
      } catch (error2) {
        if (head)
          notify();
        else
          last = void 0;
        throw error2;
      }
    }
    last = void 0;
    if (parent)
      parent.enter();
  };
  if (!engineIsIos && !engineIsNode && MutationObserver && document$2) {
    toggle = true;
    node = document$2.createTextNode("");
    new MutationObserver(flush).observe(node, {characterData: true});
    notify = function() {
      node.data = toggle = !toggle;
    };
  } else if (Promise$1 && Promise$1.resolve) {
    promise = Promise$1.resolve(void 0);
    then = promise.then;
    notify = function() {
      then.call(promise, flush);
    };
  } else if (engineIsNode) {
    notify = function() {
      process$3.nextTick(flush);
    };
  } else {
    notify = function() {
      macrotask.call(global_1, flush);
    };
  }
}
var microtask = queueMicrotask || function(fn) {
  var task2 = {fn, next: void 0};
  if (last)
    last.next = task2;
  if (!head) {
    head = task2;
    notify();
  }
  last = task2;
};
var PromiseCapability = function(C) {
  var resolve3, reject2;
  this.promise = new C(function($$resolve, $$reject) {
    if (resolve3 !== void 0 || reject2 !== void 0)
      throw TypeError("Bad Promise constructor");
    resolve3 = $$resolve;
    reject2 = $$reject;
  });
  this.resolve = aFunction$1(resolve3);
  this.reject = aFunction$1(reject2);
};
var f$5 = function(C) {
  return new PromiseCapability(C);
};
var newPromiseCapability = {
  f: f$5
};
var promiseResolve = function(C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C)
    return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve3 = promiseCapability.resolve;
  resolve3(x);
  return promiseCapability.promise;
};
var hostReportErrors = function(a, b) {
  var console2 = global_1.console;
  if (console2 && console2.error) {
    arguments.length === 1 ? console2.error(a) : console2.error(a, b);
  }
};
var perform = function(exec) {
  try {
    return {error: false, value: exec()};
  } catch (error2) {
    return {error: true, value: error2};
  }
};
var task$1 = task.set;
var SPECIES$4 = wellKnownSymbol("species");
var PROMISE = "Promise";
var getInternalState = internalState.get;
var setInternalState = internalState.set;
var getInternalPromiseState = internalState.getterFor(PROMISE);
var PromiseConstructor = nativePromiseConstructor;
var TypeError$1 = global_1.TypeError;
var document$3 = global_1.document;
var process$4 = global_1.process;
var $fetch = getBuiltIn("fetch");
var newPromiseCapability$1 = newPromiseCapability.f;
var newGenericPromiseCapability = newPromiseCapability$1;
var DISPATCH_EVENT = !!(document$3 && document$3.createEvent && global_1.dispatchEvent);
var NATIVE_REJECTION_EVENT = typeof PromiseRejectionEvent == "function";
var UNHANDLED_REJECTION = "unhandledrejection";
var REJECTION_HANDLED = "rejectionhandled";
var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;
var HANDLED = 1;
var UNHANDLED = 2;
var Internal, OwnPromiseCapability, PromiseWrapper, nativeThen;
var FORCED$1 = isForced_1(PROMISE, function() {
  var GLOBAL_CORE_JS_PROMISE = inspectSource(PromiseConstructor) !== String(PromiseConstructor);
  if (!GLOBAL_CORE_JS_PROMISE) {
    if (engineV8Version === 66)
      return true;
    if (!engineIsNode && !NATIVE_REJECTION_EVENT)
      return true;
  }
  if (engineV8Version >= 51 && /native code/.test(PromiseConstructor))
    return false;
  var promise2 = PromiseConstructor.resolve(1);
  var FakePromise = function(exec) {
    exec(function() {
    }, function() {
    });
  };
  var constructor = promise2.constructor = {};
  constructor[SPECIES$4] = FakePromise;
  return !(promise2.then(function() {
  }) instanceof FakePromise);
});
var INCORRECT_ITERATION = FORCED$1 || !checkCorrectnessOfIteration(function(iterable) {
  PromiseConstructor.all(iterable)["catch"](function() {
  });
});
var isThenable = function(it) {
  var then2;
  return isObject(it) && typeof (then2 = it.then) == "function" ? then2 : false;
};
var notify$1 = function(state, isReject) {
  if (state.notified)
    return;
  state.notified = true;
  var chain = state.reactions;
  microtask(function() {
    var value = state.value;
    var ok = state.state == FULFILLED;
    var index2 = 0;
    while (chain.length > index2) {
      var reaction = chain[index2++];
      var handler = ok ? reaction.ok : reaction.fail;
      var resolve3 = reaction.resolve;
      var reject2 = reaction.reject;
      var domain = reaction.domain;
      var result, then2, exited;
      try {
        if (handler) {
          if (!ok) {
            if (state.rejection === UNHANDLED)
              onHandleUnhandled(state);
            state.rejection = HANDLED;
          }
          if (handler === true)
            result = value;
          else {
            if (domain)
              domain.enter();
            result = handler(value);
            if (domain) {
              domain.exit();
              exited = true;
            }
          }
          if (result === reaction.promise) {
            reject2(TypeError$1("Promise-chain cycle"));
          } else if (then2 = isThenable(result)) {
            then2.call(result, resolve3, reject2);
          } else
            resolve3(result);
        } else
          reject2(value);
      } catch (error2) {
        if (domain && !exited)
          domain.exit();
        reject2(error2);
      }
    }
    state.reactions = [];
    state.notified = false;
    if (isReject && !state.rejection)
      onUnhandled(state);
  });
};
var dispatchEvent = function(name2, promise2, reason) {
  var event, handler;
  if (DISPATCH_EVENT) {
    event = document$3.createEvent("Event");
    event.promise = promise2;
    event.reason = reason;
    event.initEvent(name2, false, true);
    global_1.dispatchEvent(event);
  } else
    event = {promise: promise2, reason};
  if (!NATIVE_REJECTION_EVENT && (handler = global_1["on" + name2]))
    handler(event);
  else if (name2 === UNHANDLED_REJECTION)
    hostReportErrors("Unhandled promise rejection", reason);
};
var onUnhandled = function(state) {
  task$1.call(global_1, function() {
    var promise2 = state.facade;
    var value = state.value;
    var IS_UNHANDLED = isUnhandled(state);
    var result;
    if (IS_UNHANDLED) {
      result = perform(function() {
        if (engineIsNode) {
          process$4.emit("unhandledRejection", value, promise2);
        } else
          dispatchEvent(UNHANDLED_REJECTION, promise2, value);
      });
      state.rejection = engineIsNode || isUnhandled(state) ? UNHANDLED : HANDLED;
      if (result.error)
        throw result.value;
    }
  });
};
var isUnhandled = function(state) {
  return state.rejection !== HANDLED && !state.parent;
};
var onHandleUnhandled = function(state) {
  task$1.call(global_1, function() {
    var promise2 = state.facade;
    if (engineIsNode) {
      process$4.emit("rejectionHandled", promise2);
    } else
      dispatchEvent(REJECTION_HANDLED, promise2, state.value);
  });
};
var bind = function(fn, state, unwrap) {
  return function(value) {
    fn(state, value, unwrap);
  };
};
var internalReject = function(state, value, unwrap) {
  if (state.done)
    return;
  state.done = true;
  if (unwrap)
    state = unwrap;
  state.value = value;
  state.state = REJECTED;
  notify$1(state, true);
};
var internalResolve = function(state, value, unwrap) {
  if (state.done)
    return;
  state.done = true;
  if (unwrap)
    state = unwrap;
  try {
    if (state.facade === value)
      throw TypeError$1("Promise can't be resolved itself");
    var then2 = isThenable(value);
    if (then2) {
      microtask(function() {
        var wrapper = {done: false};
        try {
          then2.call(value, bind(internalResolve, wrapper, state), bind(internalReject, wrapper, state));
        } catch (error2) {
          internalReject(wrapper, error2, state);
        }
      });
    } else {
      state.value = value;
      state.state = FULFILLED;
      notify$1(state, false);
    }
  } catch (error2) {
    internalReject({done: false}, error2, state);
  }
};
if (FORCED$1) {
  PromiseConstructor = function Promise2(executor) {
    anInstance(this, PromiseConstructor, PROMISE);
    aFunction$1(executor);
    Internal.call(this);
    var state = getInternalState(this);
    try {
      executor(bind(internalResolve, state), bind(internalReject, state));
    } catch (error2) {
      internalReject(state, error2);
    }
  };
  Internal = function Promise2(executor) {
    setInternalState(this, {
      type: PROMISE,
      done: false,
      notified: false,
      parent: false,
      reactions: [],
      rejection: false,
      state: PENDING,
      value: void 0
    });
  };
  Internal.prototype = redefineAll(PromiseConstructor.prototype, {
    then: function then2(onFulfilled, onRejected) {
      var state = getInternalPromiseState(this);
      var reaction = newPromiseCapability$1(speciesConstructor(this, PromiseConstructor));
      reaction.ok = typeof onFulfilled == "function" ? onFulfilled : true;
      reaction.fail = typeof onRejected == "function" && onRejected;
      reaction.domain = engineIsNode ? process$4.domain : void 0;
      state.parent = true;
      state.reactions.push(reaction);
      if (state.state != PENDING)
        notify$1(state, false);
      return reaction.promise;
    },
    catch: function(onRejected) {
      return this.then(void 0, onRejected);
    }
  });
  OwnPromiseCapability = function() {
    var promise2 = new Internal();
    var state = getInternalState(promise2);
    this.promise = promise2;
    this.resolve = bind(internalResolve, state);
    this.reject = bind(internalReject, state);
  };
  newPromiseCapability.f = newPromiseCapability$1 = function(C) {
    return C === PromiseConstructor || C === PromiseWrapper ? new OwnPromiseCapability(C) : newGenericPromiseCapability(C);
  };
  if (typeof nativePromiseConstructor == "function") {
    nativeThen = nativePromiseConstructor.prototype.then;
    redefine(nativePromiseConstructor.prototype, "then", function then2(onFulfilled, onRejected) {
      var that = this;
      return new PromiseConstructor(function(resolve3, reject2) {
        nativeThen.call(that, resolve3, reject2);
      }).then(onFulfilled, onRejected);
    }, {unsafe: true});
    if (typeof $fetch == "function")
      _export({global: true, enumerable: true, forced: true}, {
        fetch: function fetch2(input) {
          return promiseResolve(PromiseConstructor, $fetch.apply(global_1, arguments));
        }
      });
  }
}
_export({global: true, wrap: true, forced: FORCED$1}, {
  Promise: PromiseConstructor
});
setToStringTag(PromiseConstructor, PROMISE, false);
setSpecies(PROMISE);
PromiseWrapper = getBuiltIn(PROMISE);
_export({target: PROMISE, stat: true, forced: FORCED$1}, {
  reject: function reject(r) {
    var capability = newPromiseCapability$1(this);
    capability.reject.call(void 0, r);
    return capability.promise;
  }
});
_export({target: PROMISE, stat: true, forced: FORCED$1}, {
  resolve: function resolve2(x) {
    return promiseResolve(this, x);
  }
});
_export({target: PROMISE, stat: true, forced: INCORRECT_ITERATION}, {
  all: function all(iterable) {
    var C = this;
    var capability = newPromiseCapability$1(C);
    var resolve3 = capability.resolve;
    var reject2 = capability.reject;
    var result = perform(function() {
      var $promiseResolve = aFunction$1(C.resolve);
      var values = [];
      var counter2 = 0;
      var remaining = 1;
      iterate(iterable, function(promise2) {
        var index2 = counter2++;
        var alreadyCalled = false;
        values.push(void 0);
        remaining++;
        $promiseResolve.call(C, promise2).then(function(value) {
          if (alreadyCalled)
            return;
          alreadyCalled = true;
          values[index2] = value;
          --remaining || resolve3(values);
        }, reject2);
      });
      --remaining || resolve3(values);
    });
    if (result.error)
      reject2(result.value);
    return capability.promise;
  },
  race: function race(iterable) {
    var C = this;
    var capability = newPromiseCapability$1(C);
    var reject2 = capability.reject;
    var result = perform(function() {
      var $promiseResolve = aFunction$1(C.resolve);
      iterate(iterable, function(promise2) {
        $promiseResolve.call(C, promise2).then(capability.resolve, reject2);
      });
    });
    if (result.error)
      reject2(result.value);
    return capability.promise;
  }
});
var MATCH = wellKnownSymbol("match");
var isRegexp = function(it) {
  var isRegExp;
  return isObject(it) && ((isRegExp = it[MATCH]) !== void 0 ? !!isRegExp : classofRaw(it) == "RegExp");
};
var notARegexp = function(it) {
  if (isRegexp(it)) {
    throw TypeError("The method doesn't accept regular expressions");
  }
  return it;
};
var MATCH$1 = wellKnownSymbol("match");
var correctIsRegexpLogic = function(METHOD_NAME) {
  var regexp = /./;
  try {
    "/./"[METHOD_NAME](regexp);
  } catch (error1) {
    try {
      regexp[MATCH$1] = false;
      return "/./"[METHOD_NAME](regexp);
    } catch (error2) {
    }
  }
  return false;
};
var getOwnPropertyDescriptor$3 = objectGetOwnPropertyDescriptor.f;
var nativeEndsWith = "".endsWith;
var min$2 = Math.min;
var CORRECT_IS_REGEXP_LOGIC = correctIsRegexpLogic("endsWith");
var MDN_POLYFILL_BUG = !CORRECT_IS_REGEXP_LOGIC && !!function() {
  var descriptor = getOwnPropertyDescriptor$3(String.prototype, "endsWith");
  return descriptor && !descriptor.writable;
}();
_export({target: "String", proto: true, forced: !MDN_POLYFILL_BUG && !CORRECT_IS_REGEXP_LOGIC}, {
  endsWith: function endsWith(searchString) {
    var that = String(requireObjectCoercible(this));
    notARegexp(searchString);
    var endPosition = arguments.length > 1 ? arguments[1] : void 0;
    var len = toLength(that.length);
    var end = endPosition === void 0 ? len : min$2(toLength(endPosition), len);
    var search = String(searchString);
    return nativeEndsWith ? nativeEndsWith.call(that, search, end) : that.slice(end - search.length, end) === search;
  }
});
var getOwnPropertyDescriptor$4 = objectGetOwnPropertyDescriptor.f;
var nativeStartsWith = "".startsWith;
var min$3 = Math.min;
var CORRECT_IS_REGEXP_LOGIC$1 = correctIsRegexpLogic("startsWith");
var MDN_POLYFILL_BUG$1 = !CORRECT_IS_REGEXP_LOGIC$1 && !!function() {
  var descriptor = getOwnPropertyDescriptor$4(String.prototype, "startsWith");
  return descriptor && !descriptor.writable;
}();
_export({target: "String", proto: true, forced: !MDN_POLYFILL_BUG$1 && !CORRECT_IS_REGEXP_LOGIC$1}, {
  startsWith: function startsWith(searchString) {
    var that = String(requireObjectCoercible(this));
    notARegexp(searchString);
    var index2 = toLength(min$3(arguments.length > 1 ? arguments[1] : void 0, that.length));
    var search = String(searchString);
    return nativeStartsWith ? nativeStartsWith.call(that, search, index2) : that.slice(index2, index2 + search.length) === search;
  }
});
var domIterables = {
  CSSRuleList: 0,
  CSSStyleDeclaration: 0,
  CSSValueList: 0,
  ClientRectList: 0,
  DOMRectList: 0,
  DOMStringList: 0,
  DOMTokenList: 1,
  DataTransferItemList: 0,
  FileList: 0,
  HTMLAllCollection: 0,
  HTMLCollection: 0,
  HTMLFormElement: 0,
  HTMLSelectElement: 0,
  MediaList: 0,
  MimeTypeArray: 0,
  NamedNodeMap: 0,
  NodeList: 1,
  PaintRequestList: 0,
  Plugin: 0,
  PluginArray: 0,
  SVGLengthList: 0,
  SVGNumberList: 0,
  SVGPathSegList: 0,
  SVGPointList: 0,
  SVGStringList: 0,
  SVGTransformList: 0,
  SourceBufferList: 0,
  StyleSheetList: 0,
  TextTrackCueList: 0,
  TextTrackList: 0,
  TouchList: 0
};
for (var COLLECTION_NAME in domIterables) {
  var Collection = global_1[COLLECTION_NAME];
  var CollectionPrototype = Collection && Collection.prototype;
  if (CollectionPrototype && CollectionPrototype.forEach !== arrayForEach)
    try {
      createNonEnumerableProperty(CollectionPrototype, "forEach", arrayForEach);
    } catch (error2) {
      CollectionPrototype.forEach = arrayForEach;
    }
}
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var bind$1 = function bind2(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};
var toString$1 = Object.prototype.toString;
function isArray$1(val) {
  return toString$1.call(val) === "[object Array]";
}
function isUndefined(val) {
  return typeof val === "undefined";
}
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && typeof val.constructor.isBuffer === "function" && val.constructor.isBuffer(val);
}
function isArrayBuffer(val) {
  return toString$1.call(val) === "[object ArrayBuffer]";
}
function isFormData(val) {
  return typeof FormData !== "undefined" && val instanceof FormData;
}
function isArrayBufferView(val) {
  var result;
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView) {
    result = ArrayBuffer.isView(val);
  } else {
    result = val && val.buffer && val.buffer instanceof ArrayBuffer;
  }
  return result;
}
function isString(val) {
  return typeof val === "string";
}
function isNumber(val) {
  return typeof val === "number";
}
function isObject$1(val) {
  return val !== null && typeof val === "object";
}
function isPlainObject(val) {
  if (toString$1.call(val) !== "[object Object]") {
    return false;
  }
  var prototype = Object.getPrototypeOf(val);
  return prototype === null || prototype === Object.prototype;
}
function isDate(val) {
  return toString$1.call(val) === "[object Date]";
}
function isFile(val) {
  return toString$1.call(val) === "[object File]";
}
function isBlob(val) {
  return toString$1.call(val) === "[object Blob]";
}
function isFunction(val) {
  return toString$1.call(val) === "[object Function]";
}
function isStream(val) {
  return isObject$1(val) && isFunction(val.pipe);
}
function isURLSearchParams(val) {
  return typeof URLSearchParams !== "undefined" && val instanceof URLSearchParams;
}
function trim(str) {
  return str.replace(/^\s*/, "").replace(/\s*$/, "");
}
function isStandardBrowserEnv() {
  if (typeof navigator !== "undefined" && (navigator.product === "ReactNative" || navigator.product === "NativeScript" || navigator.product === "NS")) {
    return false;
  }
  return typeof window !== "undefined" && typeof document !== "undefined";
}
function forEach2(obj, fn) {
  if (obj === null || typeof obj === "undefined") {
    return;
  }
  if (typeof obj !== "object") {
    obj = [obj];
  }
  if (isArray$1(obj)) {
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}
function merge() {
  var result = {};
  function assignValue(val, key) {
    if (isPlainObject(result[key]) && isPlainObject(val)) {
      result[key] = merge(result[key], val);
    } else if (isPlainObject(val)) {
      result[key] = merge({}, val);
    } else if (isArray$1(val)) {
      result[key] = val.slice();
    } else {
      result[key] = val;
    }
  }
  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach2(arguments[i], assignValue);
  }
  return result;
}
function extend(a, b, thisArg) {
  forEach2(b, function assignValue(val, key) {
    if (thisArg && typeof val === "function") {
      a[key] = bind$1(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}
function stripBOM(content) {
  if (content.charCodeAt(0) === 65279) {
    content = content.slice(1);
  }
  return content;
}
var utils = {
  isArray: isArray$1,
  isArrayBuffer,
  isBuffer,
  isFormData,
  isArrayBufferView,
  isString,
  isNumber,
  isObject: isObject$1,
  isPlainObject,
  isUndefined,
  isDate,
  isFile,
  isBlob,
  isFunction,
  isStream,
  isURLSearchParams,
  isStandardBrowserEnv,
  forEach: forEach2,
  merge,
  extend,
  trim,
  stripBOM
};
function encode(val) {
  return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+").replace(/%5B/gi, "[").replace(/%5D/gi, "]");
}
var buildURL = function buildURL2(url, params, paramsSerializer) {
  if (!params) {
    return url;
  }
  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];
    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === "undefined") {
        return;
      }
      if (utils.isArray(val)) {
        key = key + "[]";
      } else {
        val = [val];
      }
      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + "=" + encode(v));
      });
    });
    serializedParams = parts.join("&");
  }
  if (serializedParams) {
    var hashmarkIndex = url.indexOf("#");
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    url += (url.indexOf("?") === -1 ? "?" : "&") + serializedParams;
  }
  return url;
};
function InterceptorManager() {
  this.handlers = [];
}
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled,
    rejected
  });
  return this.handlers.length - 1;
};
InterceptorManager.prototype.eject = function eject(id2) {
  if (this.handlers[id2]) {
    this.handlers[id2] = null;
  }
};
InterceptorManager.prototype.forEach = function forEach3(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};
var InterceptorManager_1 = InterceptorManager;
var transformData = function transformData2(data2, headers, fns) {
  utils.forEach(fns, function transform(fn) {
    data2 = fn(data2, headers);
  });
  return data2;
};
var isCancel = function isCancel2(value) {
  return !!(value && value.__CANCEL__);
};
var normalizeHeaderName = function normalizeHeaderName2(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name2) {
    if (name2 !== normalizedName && name2.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name2];
    }
  });
};
var enhanceError = function enhanceError2(error2, config, code, request2, response) {
  error2.config = config;
  if (code) {
    error2.code = code;
  }
  error2.request = request2;
  error2.response = response;
  error2.isAxiosError = true;
  error2.toJSON = function toJSON() {
    return {
      message: this.message,
      name: this.name,
      description: this.description,
      number: this.number,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      config: this.config,
      code: this.code
    };
  };
  return error2;
};
var createError = function createError2(message, config, code, request2, response) {
  var error2 = new Error(message);
  return enhanceError(error2, config, code, request2, response);
};
var settle = function settle2(resolve3, reject2, response) {
  var validateStatus2 = response.config.validateStatus;
  if (!response.status || !validateStatus2 || validateStatus2(response.status)) {
    resolve3(response);
  } else {
    reject2(createError("Request failed with status code " + response.status, response.config, null, response.request, response));
  }
};
var cookies = utils.isStandardBrowserEnv() ? function standardBrowserEnv() {
  return {
    write: function write(name2, value, expires, path2, domain, secure) {
      var cookie = [];
      cookie.push(name2 + "=" + encodeURIComponent(value));
      if (utils.isNumber(expires)) {
        cookie.push("expires=" + new Date(expires).toGMTString());
      }
      if (utils.isString(path2)) {
        cookie.push("path=" + path2);
      }
      if (utils.isString(domain)) {
        cookie.push("domain=" + domain);
      }
      if (secure === true) {
        cookie.push("secure");
      }
      document.cookie = cookie.join("; ");
    },
    read: function read2(name2) {
      var match2 = document.cookie.match(new RegExp("(^|;\\s*)(" + name2 + ")=([^;]*)"));
      return match2 ? decodeURIComponent(match2[3]) : null;
    },
    remove: function remove(name2) {
      this.write(name2, "", Date.now() - 864e5);
    }
  };
}() : function nonStandardBrowserEnv() {
  return {
    write: function write() {
    },
    read: function read2() {
      return null;
    },
    remove: function remove() {
    }
  };
}();
var isAbsoluteURL = function isAbsoluteURL2(url) {
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};
var combineURLs = function combineURLs2(baseURL, relativeURL) {
  return relativeURL ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
};
var buildFullPath = function buildFullPath2(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};
var ignoreDuplicateOf = [
  "age",
  "authorization",
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "user-agent"
];
var parseHeaders = function parseHeaders2(headers) {
  var parsed = {};
  var key;
  var val;
  var i;
  if (!headers) {
    return parsed;
  }
  utils.forEach(headers.split("\n"), function parser(line) {
    i = line.indexOf(":");
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));
    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === "set-cookie") {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ", " + val : val;
      }
    }
  });
  return parsed;
};
var isURLSameOrigin = utils.isStandardBrowserEnv() ? function standardBrowserEnv2() {
  var msie = /(msie|trident)/i.test(navigator.userAgent);
  var urlParsingNode = document.createElement("a");
  var originURL;
  function resolveURL(url) {
    var href = url;
    if (msie) {
      urlParsingNode.setAttribute("href", href);
      href = urlParsingNode.href;
    }
    urlParsingNode.setAttribute("href", href);
    return {
      href: urlParsingNode.href,
      protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, "") : "",
      host: urlParsingNode.host,
      search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, "") : "",
      hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, "") : "",
      hostname: urlParsingNode.hostname,
      port: urlParsingNode.port,
      pathname: urlParsingNode.pathname.charAt(0) === "/" ? urlParsingNode.pathname : "/" + urlParsingNode.pathname
    };
  }
  originURL = resolveURL(window.location.href);
  return function isURLSameOrigin2(requestURL) {
    var parsed = utils.isString(requestURL) ? resolveURL(requestURL) : requestURL;
    return parsed.protocol === originURL.protocol && parsed.host === originURL.host;
  };
}() : function nonStandardBrowserEnv2() {
  return function isURLSameOrigin2() {
    return true;
  };
}();
var xhr = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve3, reject2) {
    var requestData = config.data;
    var requestHeaders = config.headers;
    if (utils.isFormData(requestData)) {
      delete requestHeaders["Content-Type"];
    }
    var request2 = new XMLHttpRequest();
    if (config.auth) {
      var username = config.auth.username || "";
      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : "";
      requestHeaders.Authorization = "Basic " + btoa(username + ":" + password);
    }
    var fullPath = buildFullPath(config.baseURL, config.url);
    request2.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);
    request2.timeout = config.timeout;
    request2.onreadystatechange = function handleLoad() {
      if (!request2 || request2.readyState !== 4) {
        return;
      }
      if (request2.status === 0 && !(request2.responseURL && request2.responseURL.indexOf("file:") === 0)) {
        return;
      }
      var responseHeaders = "getAllResponseHeaders" in request2 ? parseHeaders(request2.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === "text" ? request2.responseText : request2.response;
      var response = {
        data: responseData,
        status: request2.status,
        statusText: request2.statusText,
        headers: responseHeaders,
        config,
        request: request2
      };
      settle(resolve3, reject2, response);
      request2 = null;
    };
    request2.onabort = function handleAbort() {
      if (!request2) {
        return;
      }
      reject2(createError("Request aborted", config, "ECONNABORTED", request2));
      request2 = null;
    };
    request2.onerror = function handleError() {
      reject2(createError("Network Error", config, null, request2));
      request2 = null;
    };
    request2.ontimeout = function handleTimeout() {
      var timeoutErrorMessage = "timeout of " + config.timeout + "ms exceeded";
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject2(createError(timeoutErrorMessage, config, "ECONNABORTED", request2));
      request2 = null;
    };
    if (utils.isStandardBrowserEnv()) {
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ? cookies.read(config.xsrfCookieName) : void 0;
      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }
    if ("setRequestHeader" in request2) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === "undefined" && key.toLowerCase() === "content-type") {
          delete requestHeaders[key];
        } else {
          request2.setRequestHeader(key, val);
        }
      });
    }
    if (!utils.isUndefined(config.withCredentials)) {
      request2.withCredentials = !!config.withCredentials;
    }
    if (config.responseType) {
      try {
        request2.responseType = config.responseType;
      } catch (e) {
        if (config.responseType !== "json") {
          throw e;
        }
      }
    }
    if (typeof config.onDownloadProgress === "function") {
      request2.addEventListener("progress", config.onDownloadProgress);
    }
    if (typeof config.onUploadProgress === "function" && request2.upload) {
      request2.upload.addEventListener("progress", config.onUploadProgress);
    }
    if (config.cancelToken) {
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request2) {
          return;
        }
        request2.abort();
        reject2(cancel);
        request2 = null;
      });
    }
    if (!requestData) {
      requestData = null;
    }
    request2.send(requestData);
  });
};
var DEFAULT_CONTENT_TYPE = {
  "Content-Type": "application/x-www-form-urlencoded"
};
function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers["Content-Type"])) {
    headers["Content-Type"] = value;
  }
}
function getDefaultAdapter() {
  var adapter;
  if (typeof XMLHttpRequest !== "undefined") {
    adapter = xhr;
  } else if (typeof process !== "undefined" && Object.prototype.toString.call(process) === "[object process]") {
    adapter = xhr;
  }
  return adapter;
}
var defaults = {
  adapter: getDefaultAdapter(),
  transformRequest: [function transformRequest(data2, headers) {
    normalizeHeaderName(headers, "Accept");
    normalizeHeaderName(headers, "Content-Type");
    if (utils.isFormData(data2) || utils.isArrayBuffer(data2) || utils.isBuffer(data2) || utils.isStream(data2) || utils.isFile(data2) || utils.isBlob(data2)) {
      return data2;
    }
    if (utils.isArrayBufferView(data2)) {
      return data2.buffer;
    }
    if (utils.isURLSearchParams(data2)) {
      setContentTypeIfUnset(headers, "application/x-www-form-urlencoded;charset=utf-8");
      return data2.toString();
    }
    if (utils.isObject(data2)) {
      setContentTypeIfUnset(headers, "application/json;charset=utf-8");
      return JSON.stringify(data2);
    }
    return data2;
  }],
  transformResponse: [function transformResponse(data2) {
    if (typeof data2 === "string") {
      try {
        data2 = JSON.parse(data2);
      } catch (e) {
      }
    }
    return data2;
  }],
  timeout: 0,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  maxContentLength: -1,
  maxBodyLength: -1,
  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};
defaults.headers = {
  common: {
    Accept: "application/json, text/plain, */*"
  }
};
utils.forEach(["delete", "get", "head"], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});
utils.forEach(["post", "put", "patch"], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});
var defaults_1 = defaults;
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}
var dispatchRequest = function dispatchRequest2(config) {
  throwIfCancellationRequested(config);
  config.headers = config.headers || {};
  config.data = transformData(config.data, config.headers, config.transformRequest);
  config.headers = utils.merge(config.headers.common || {}, config.headers[config.method] || {}, config.headers);
  utils.forEach(["delete", "get", "head", "post", "put", "patch", "common"], function cleanHeaderConfig(method) {
    delete config.headers[method];
  });
  var adapter = config.adapter || defaults_1.adapter;
  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);
    response.data = transformData(response.data, response.headers, config.transformResponse);
    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);
      if (reason && reason.response) {
        reason.response.data = transformData(reason.response.data, reason.response.headers, config.transformResponse);
      }
    }
    return Promise.reject(reason);
  });
};
var mergeConfig = function mergeConfig2(config1, config2) {
  config2 = config2 || {};
  var config = {};
  var valueFromConfig2Keys = ["url", "method", "data"];
  var mergeDeepPropertiesKeys = ["headers", "auth", "proxy", "params"];
  var defaultToConfig2Keys = [
    "baseURL",
    "transformRequest",
    "transformResponse",
    "paramsSerializer",
    "timeout",
    "timeoutMessage",
    "withCredentials",
    "adapter",
    "responseType",
    "xsrfCookieName",
    "xsrfHeaderName",
    "onUploadProgress",
    "onDownloadProgress",
    "decompress",
    "maxContentLength",
    "maxBodyLength",
    "maxRedirects",
    "transport",
    "httpAgent",
    "httpsAgent",
    "cancelToken",
    "socketPath",
    "responseEncoding"
  ];
  var directMergeKeys = ["validateStatus"];
  function getMergedValue(target, source2) {
    if (utils.isPlainObject(target) && utils.isPlainObject(source2)) {
      return utils.merge(target, source2);
    } else if (utils.isPlainObject(source2)) {
      return utils.merge({}, source2);
    } else if (utils.isArray(source2)) {
      return source2.slice();
    }
    return source2;
  }
  function mergeDeepProperties(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(void 0, config1[prop]);
    }
  }
  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(void 0, config2[prop]);
    }
  });
  utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);
  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (!utils.isUndefined(config2[prop])) {
      config[prop] = getMergedValue(void 0, config2[prop]);
    } else if (!utils.isUndefined(config1[prop])) {
      config[prop] = getMergedValue(void 0, config1[prop]);
    }
  });
  utils.forEach(directMergeKeys, function merge2(prop) {
    if (prop in config2) {
      config[prop] = getMergedValue(config1[prop], config2[prop]);
    } else if (prop in config1) {
      config[prop] = getMergedValue(void 0, config1[prop]);
    }
  });
  var axiosKeys = valueFromConfig2Keys.concat(mergeDeepPropertiesKeys).concat(defaultToConfig2Keys).concat(directMergeKeys);
  var otherKeys = Object.keys(config1).concat(Object.keys(config2)).filter(function filterAxiosKeys(key) {
    return axiosKeys.indexOf(key) === -1;
  });
  utils.forEach(otherKeys, mergeDeepProperties);
  return config;
};
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager_1(),
    response: new InterceptorManager_1()
  };
}
Axios.prototype.request = function request(config) {
  if (typeof config === "string") {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }
  config = mergeConfig(this.defaults, config);
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = "get";
  }
  var chain = [dispatchRequest, void 0];
  var promise2 = Promise.resolve(config);
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });
  while (chain.length) {
    promise2 = promise2.then(chain.shift(), chain.shift());
  }
  return promise2;
};
Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, "");
};
utils.forEach(["delete", "get", "head", "options"], function forEachMethodNoData2(method) {
  Axios.prototype[method] = function(url, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url,
      data: (config || {}).data
    }));
  };
});
utils.forEach(["post", "put", "patch"], function forEachMethodWithData2(method) {
  Axios.prototype[method] = function(url, data2, config) {
    return this.request(mergeConfig(config || {}, {
      method,
      url,
      data: data2
    }));
  };
});
var Axios_1 = Axios;
function Cancel(message) {
  this.message = message;
}
Cancel.prototype.toString = function toString3() {
  return "Cancel" + (this.message ? ": " + this.message : "");
};
Cancel.prototype.__CANCEL__ = true;
var Cancel_1 = Cancel;
function CancelToken(executor) {
  if (typeof executor !== "function") {
    throw new TypeError("executor must be a function.");
  }
  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve3) {
    resolvePromise = resolve3;
  });
  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      return;
    }
    token.reason = new Cancel_1(message);
    resolvePromise(token.reason);
  });
}
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token,
    cancel
  };
};
var CancelToken_1 = CancelToken;
var spread = function spread2(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};
function createInstance(defaultConfig) {
  var context = new Axios_1(defaultConfig);
  var instance = bind$1(Axios_1.prototype.request, context);
  utils.extend(instance, Axios_1.prototype, context);
  utils.extend(instance, context);
  return instance;
}
var axios = createInstance(defaults_1);
axios.Axios = Axios_1;
axios.create = function create2(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
axios.Cancel = Cancel_1;
axios.CancelToken = CancelToken_1;
axios.isCancel = isCancel;
axios.all = function all2(promises) {
  return Promise.all(promises);
};
axios.spread = spread;
var axios_1 = axios;
var default_1 = axios;
axios_1.default = default_1;
var axios$1 = axios_1;
var supportedVersions = ["v2", "v3", "v4", "canary"];
var name = "@tryghost/content-api";
function GhostContentAPI(_ref) {
  var url = _ref.url, host = _ref.host, _ref$ghostPath = _ref.ghostPath, ghostPath = _ref$ghostPath === void 0 ? "ghost" : _ref$ghostPath, version2 = _ref.version, key = _ref.key;
  if (host) {
    console.warn("".concat(name, ": The 'host' parameter is deprecated, please use 'url' instead"));
    if (!url) {
      url = host;
    }
  }
  if (this instanceof GhostContentAPI) {
    return GhostContentAPI({
      url,
      version: version2,
      key
    });
  }
  if (!version2) {
    throw new Error("".concat(name, " Config Missing: 'version' is required. E.g. ").concat(supportedVersions.join(",")));
  }
  if (!supportedVersions.includes(version2)) {
    throw new Error("".concat(name, " Config Invalid: 'version' ").concat(version2, " is not supported"));
  }
  if (!url) {
    throw new Error("".concat(name, " Config Missing: 'url' is required. E.g. 'https://site.com'"));
  }
  if (!/https?:\/\//.test(url)) {
    throw new Error("".concat(name, " Config Invalid: 'url' ").concat(url, " requires a protocol. E.g. 'https://site.com'"));
  }
  if (url.endsWith("/")) {
    throw new Error("".concat(name, " Config Invalid: 'url' ").concat(url, " must not have a trailing slash. E.g. 'https://site.com'"));
  }
  if (ghostPath.endsWith("/") || ghostPath.startsWith("/")) {
    throw new Error("".concat(name, " Config Invalid: 'ghostPath' ").concat(ghostPath, " must not have a leading or trailing slash. E.g. 'ghost'"));
  }
  if (key && !/[0-9a-f]{26}/.test(key)) {
    throw new Error("".concat(name, " Config Invalid: 'key' ").concat(key, " must have 26 hex characters"));
  }
  var api = ["posts", "authors", "tags", "pages", "settings"].reduce(function(apiObject, resourceType) {
    function browse() {
      var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      var memberToken = arguments.length > 1 ? arguments[1] : void 0;
      return makeRequest(resourceType, options, null, memberToken);
    }
    function read2(data2) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      var memberToken = arguments.length > 2 ? arguments[2] : void 0;
      if (!data2 || !data2.id && !data2.slug) {
        return Promise.reject(new Error("".concat(name, " read requires an id or slug.")));
      }
      var params = Object.assign({}, data2, options);
      return makeRequest(resourceType, params, data2.id || "slug/".concat(data2.slug), memberToken);
    }
    return Object.assign(apiObject, _defineProperty({}, resourceType, {
      read: read2,
      browse
    }));
  }, {});
  delete api.settings.read;
  return api;
  function makeRequest(resourceType, params, id2) {
    var membersToken = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
    if (!membersToken && !key) {
      return Promise.reject(new Error("".concat(name, " Config Missing: 'key' is required.")));
    }
    delete params.id;
    var headers = membersToken ? {
      Authorization: "GhostMembers ".concat(membersToken)
    } : void 0;
    return axios$1.get("".concat(url, "/").concat(ghostPath, "/api/").concat(version2, "/content/").concat(resourceType, "/").concat(id2 ? id2 + "/" : ""), {
      params: Object.assign({
        key
      }, params),
      paramsSerializer: function paramsSerializer(parameters) {
        return Object.keys(parameters).reduce(function(parts, k) {
          var val = encodeURIComponent([].concat(parameters[k]).join(","));
          return parts.concat("".concat(k, "=").concat(val));
        }, []).join("&");
      },
      headers
    }).then(function(res) {
      if (!Array.isArray(res.data[resourceType])) {
        return res.data[resourceType];
      }
      if (res.data[resourceType].length === 1 && !res.data.meta) {
        return res.data[resourceType][0];
      }
      return Object.assign(res.data[resourceType], {
        meta: res.data.meta
      });
    }).catch(function(err) {
      if (err.response && err.response.data && err.response.data.errors) {
        var props = err.response.data.errors[0];
        var toThrow = new Error(props.message);
        var keys4 = Object.keys(props);
        toThrow.name = props.type;
        keys4.forEach(function(k) {
          toThrow[k] = props[k];
        });
        toThrow.response = err.response;
        toThrow.request = err.request;
        toThrow.config = err.config;
        throw toThrow;
      } else {
        throw err;
      }
    });
  }
}
const subscriber_queue = [];
function writable(value, start = noop) {
  let stop;
  const subscribers = [];
  function set2(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s2 = subscribers[i];
          s2[1]();
          subscriber_queue.push(s2, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set2(fn(value));
  }
  function subscribe2(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set2) || noop;
    }
    run2(value);
    return () => {
      const index2 = subscribers.indexOf(subscriber);
      if (index2 !== -1) {
        subscribers.splice(index2, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return {set: set2, update, subscribe: subscribe2};
}
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const allArticles = writable([]);
function loadRecentArticles() {
  const api = new GhostContentAPI({
    url: "https://testing-svelte.ghost.io",
    key: "23602dc86c8aeea22d4d64ef3a",
    version: "v3"
  });
  api.posts.browse({
    limit: 3,
    include: "tags, authors, created_at"
  }).then((posts) => {
    allArticles.update((articles) => {
      return posts;
    });
    cleanUpDate();
  }).catch((err) => {
    console.error(err);
  });
}
loadRecentArticles();
function loadFavoriteArticles() {
  const api = new GhostContentAPI({
    url: "https://testing-svelte.ghost.io",
    key: "23602dc86c8aeea22d4d64ef3a",
    version: "v3"
  });
  api.posts.browse({
    limit: 5,
    include: "tags, authors, created_at",
    filter: "tag: favorite"
  }).then((posts) => {
    allArticles.update((articles) => {
      return posts;
    });
    cleanUpDate();
  }).catch((err) => {
    console.error(err);
  });
}
function cleanUpDate() {
  allArticles.update((articles) => {
    let updatedArticles = [...articles];
    updatedArticles.forEach((article) => {
      let day = article.created_at.substring(8, 10);
      let month = monthNames[parseInt(article.created_at.substring(5, 7), 10) - 1].substring(0, 3);
      let year = article.created_at.substring(0, 4);
      article.created_at = `${day}, ${month}, ${year}`;
    });
    return updatedArticles;
  });
}
function clearAllArticles() {
  allArticles.update((articles) => {
    return [];
  });
}
const customArticleStore = {
  subscribe: allArticles.subscribe,
  updateRecentArticles: loadRecentArticles,
  updateFavoriteArticles: loadFavoriteArticles,
  clearArticles: clearAllArticles
};
var Badges_svelte = ".tag-container.svelte-1spjql6.svelte-1spjql6{user-select:none;font-family:var(--garamond);width:100%;height:30px;display:flex;place-items:unset;flex-flow:row nowrap;justify-content:center;align-items:center}.tag-container.svelte-1spjql6 p.svelte-1spjql6{font-size:22px;border-radius:4px;color:white;position:relative;width:auto;padding:0.2rem 0.7rem;background:var(--primary-200);margin:0 0.5rem}";
const css$5 = {
  code: ".tag-container.svelte-1spjql6.svelte-1spjql6{user-select:none;font-family:var(--garamond);width:100%;height:30px;display:flex;place-items:unset;flex-flow:row nowrap;justify-content:center;align-items:center}.tag-container.svelte-1spjql6 p.svelte-1spjql6{font-size:22px;border-radius:4px;color:white;position:relative;width:auto;padding:0.2rem 0.7rem;background:var(--primary-200);margin:0 0.5rem}",
  map: '{"version":3,"file":"Badges.svelte","sources":["Badges.svelte"],"sourcesContent":["<script>\\r\\n  export let favBadge = false;\\r\\n  export let tags = [];\\r\\n</script>\\r\\n\\r\\n<div\\r\\n  class=\\"tag-container\\" class:tag={!favBadge}\\r\\n>\\r\\n{#if favBadge}\\r\\n  <p>favourite!</p>\\r\\n{:else}\\r\\n  {#each tags as tag}\\r\\n    <p class:tag={!favBadge}>{tag.name}</p>\\r\\n  {/each}\\r\\n{/if}\\r\\n</div>\\r\\n\\r\\n<style lang=\\"scss\\">.tag-container {\\n  user-select: none;\\n  font-family: var(--garamond);\\n  width: 100%;\\n  height: 30px;\\n  display: flex;\\n  place-items: unset;\\n  flex-flow: row nowrap;\\n  justify-content: center;\\n  align-items: center;\\n}\\n.tag-container p {\\n  font-size: 22px;\\n  border-radius: 4px;\\n  color: white;\\n  position: relative;\\n  width: auto;\\n  padding: 0.2rem 0.7rem;\\n  background: var(--primary-200);\\n  margin: 0 0.5rem;\\n}</style>\\r\\n"],"names":[],"mappings":"AAiBmB,cAAc,8BAAC,CAAC,AACjC,WAAW,CAAE,IAAI,CACjB,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,KAAK,CAClB,SAAS,CAAE,GAAG,CAAC,MAAM,CACrB,eAAe,CAAE,MAAM,CACvB,WAAW,CAAE,MAAM,AACrB,CAAC,AACD,6BAAc,CAAC,CAAC,eAAC,CAAC,AAChB,SAAS,CAAE,IAAI,CACf,aAAa,CAAE,GAAG,CAClB,KAAK,CAAE,KAAK,CACZ,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,IAAI,CACX,OAAO,CAAE,MAAM,CAAC,MAAM,CACtB,UAAU,CAAE,IAAI,aAAa,CAAC,CAC9B,MAAM,CAAE,CAAC,CAAC,MAAM,AAClB,CAAC"}'
};
const Badges = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {favBadge = false} = $$props;
  let {tags = []} = $$props;
  if ($$props.favBadge === void 0 && $$bindings.favBadge && favBadge !== void 0)
    $$bindings.favBadge(favBadge);
  if ($$props.tags === void 0 && $$bindings.tags && tags !== void 0)
    $$bindings.tags(tags);
  $$result.css.add(css$5);
  return `<div class="${["tag-container svelte-1spjql6", !favBadge ? "tag" : ""].join(" ").trim()}">${favBadge ? `<p class="${"svelte-1spjql6"}">favourite!</p>` : `${each(tags, (tag) => `<p class="${["svelte-1spjql6", !favBadge ? "tag" : ""].join(" ").trim()}">${escape(tag.name)}</p>`)}`}
</div>`;
});
var Articles_svelte = "ul.svelte-1adtjx4.svelte-1adtjx4{width:100%;max-width:770px;grid-column:2/3;margin:0}li.svelte-1adtjx4.svelte-1adtjx4{height:auto;text-decoration:none;list-style-type:none;display:flex;flex-flow:column nowrap;justify-content:space-around;align-items:center;margin-bottom:3rem}li.svelte-1adtjx4 a.svelte-1adtjx4{text-decoration:none;font-size:2rem}li.svelte-1adtjx4 a.svelte-1adtjx4:hover,li.svelte-1adtjx4 a.svelte-1adtjx4:focus,li.svelte-1adtjx4 a.svelte-1adtjx4:active{text-decoration:none;color:inherit}.buttons.svelte-1adtjx4.svelte-1adtjx4{margin-bottom:0;grid-column:2/3;align-self:center}button.svelte-1adtjx4.svelte-1adtjx4{background:transparent;outline:none;border:none;font-family:var(--garamond);font-size:23px;font-weight:700;margin:0 20px;color:var(--disabled);transition:all 250ms ease;cursor:pointer}button.svelte-1adtjx4.svelte-1adtjx4:hover{color:var(--primary-200);text-decoration:underline}button.selected.svelte-1adtjx4.svelte-1adtjx4{color:var(--primary-200)}.flex-container.svelte-1adtjx4.svelte-1adtjx4{display:flex;flex-flow:column nowrap;justify-content:space-between;align-items:center}.title.svelte-1adtjx4.svelte-1adtjx4{font-family:var(--garamond);font-size:clamp(35px, 20px + 4vw, 60px);color:var(--black);font-weight:500;margin-bottom:1.5rem}p.date.svelte-1adtjx4.svelte-1adtjx4{color:var(--disabled);font-family:var(--garamond);font-size:1rem}p.excerpt.svelte-1adtjx4.svelte-1adtjx4{margin-top:1rem;font-family:var(--openSans);color:#4d4d4d;font-size:1rem}a.read-more.svelte-1adtjx4.svelte-1adtjx4{font-size:1rem;font-family:var(--openSans);color:var(--primary-300);font-weight:600}a.read-more.svelte-1adtjx4.svelte-1adtjx4:hover{color:var(--primary-200)}";
const css$4 = {
  code: "ul.svelte-1adtjx4.svelte-1adtjx4{width:100%;max-width:770px;grid-column:2/3;margin:0}li.svelte-1adtjx4.svelte-1adtjx4{height:auto;text-decoration:none;list-style-type:none;display:flex;flex-flow:column nowrap;justify-content:space-around;align-items:center;margin-bottom:3rem}li.svelte-1adtjx4 a.svelte-1adtjx4{text-decoration:none;font-size:2rem}li.svelte-1adtjx4 a.svelte-1adtjx4:hover,li.svelte-1adtjx4 a.svelte-1adtjx4:focus,li.svelte-1adtjx4 a.svelte-1adtjx4:active{text-decoration:none;color:inherit}.buttons.svelte-1adtjx4.svelte-1adtjx4{margin-bottom:0;grid-column:2/3;align-self:center}button.svelte-1adtjx4.svelte-1adtjx4{background:transparent;outline:none;border:none;font-family:var(--garamond);font-size:23px;font-weight:700;margin:0 20px;color:var(--disabled);transition:all 250ms ease;cursor:pointer}button.svelte-1adtjx4.svelte-1adtjx4:hover{color:var(--primary-200);text-decoration:underline}button.selected.svelte-1adtjx4.svelte-1adtjx4{color:var(--primary-200)}.flex-container.svelte-1adtjx4.svelte-1adtjx4{display:flex;flex-flow:column nowrap;justify-content:space-between;align-items:center}.title.svelte-1adtjx4.svelte-1adtjx4{font-family:var(--garamond);font-size:clamp(35px, 20px + 4vw, 60px);color:var(--black);font-weight:500;margin-bottom:1.5rem}p.date.svelte-1adtjx4.svelte-1adtjx4{color:var(--disabled);font-family:var(--garamond);font-size:1rem}p.excerpt.svelte-1adtjx4.svelte-1adtjx4{margin-top:1rem;font-family:var(--openSans);color:#4d4d4d;font-size:1rem}a.read-more.svelte-1adtjx4.svelte-1adtjx4{font-size:1rem;font-family:var(--openSans);color:var(--primary-300);font-weight:600}a.read-more.svelte-1adtjx4.svelte-1adtjx4:hover{color:var(--primary-200)}",
  map: `{"version":3,"file":"Articles.svelte","sources":["Articles.svelte"],"sourcesContent":["<script>\\r\\n  import Badges from \\"$lib/Badges.svelte\\";\\r\\n  import { fly } from \\"svelte/transition\\";\\r\\n  import { createEventDispatcher } from \\"svelte\\";\\r\\n  export let articles;\\r\\n  const dispatch = createEventDispatcher();\\r\\n  export let buttonSelection;\\r\\n  export let loadingContent;\\r\\n\\r\\n  import {getContext} from 'svelte';\\r\\n  let globalSize = getContext('size')\\r\\n  \\r\\n  $: console.log($globalSize)\\r\\n</script>\\r\\n<div class=\\"buttons\\">\\r\\n  <button\\r\\n    class:selected={buttonSelection == \\"recent\\"}\\r\\n    on:click={() => dispatch('loader', \\"recent\\")}\\r\\n    >Newest</button\\r\\n  >\\r\\n  <button\\r\\n    on:click={() => dispatch('loader', \\"favourite\\")}\\r\\n    class:selected={buttonSelection == \\"favourite\\"}>Start Here</button\\r\\n  >\\r\\n</div>\\r\\n\\r\\n{#if !loadingContent}\\r\\n     <ul>\\r\\n       {#each articles as post, i}\\r\\n         <li in:fly={{ duration: 250, x: -50 }} out:fly={{ duration: 250, x: -50 }}>\\r\\n           <div class=\\"flex-container\\">\\r\\n             <p class=\\"date\\">\\r\\n               {post.created_at}\\r\\n             </p>\\r\\n             <a href=\\"./posts/{post.slug}\\" class=\\"title\\">{post.title}</a>\\r\\n           </div>\\r\\n           {#if buttonSelection == \\"favourite\\"}\\r\\n             <Badges favBadge=\\"true\\" />\\r\\n           {:else}\\r\\n             <Badges tags={post.tags} />\\r\\n           {/if}\\r\\n           <p class=\\"excerpt\\">\\r\\n             {post.excerpt}\\r\\n             <a href=\\"./posts/{post.slug}\\" class=\\"read-more\\">read more</a>\\r\\n           </p>\\r\\n         </li>\\r\\n       {/each}\\r\\n     </ul>\\r\\n{/if}\\r\\n\\r\\n<style lang=\\"scss\\">ul {\\n  width: 100%;\\n  max-width: 770px;\\n  grid-column: 2/3;\\n  margin: 0;\\n}\\n\\nli {\\n  height: auto;\\n  text-decoration: none;\\n  list-style-type: none;\\n  display: flex;\\n  flex-flow: column nowrap;\\n  justify-content: space-around;\\n  align-items: center;\\n  margin-bottom: 3rem;\\n}\\nli a {\\n  text-decoration: none;\\n  font-size: 2rem;\\n}\\nli a:hover,\\nli a:focus,\\nli a:active {\\n  text-decoration: none;\\n  color: inherit;\\n}\\n\\n.buttons {\\n  margin-bottom: 0;\\n  grid-column: 2/3;\\n  align-self: center;\\n}\\n\\nbutton {\\n  background: transparent;\\n  outline: none;\\n  border: none;\\n  font-family: var(--garamond);\\n  font-size: 23px;\\n  font-weight: 700;\\n  margin: 0 20px;\\n  color: var(--disabled);\\n  transition: all 250ms ease;\\n  cursor: pointer;\\n}\\nbutton:hover {\\n  color: var(--primary-200);\\n  text-decoration: underline;\\n}\\n\\nbutton.selected {\\n  color: var(--primary-200);\\n}\\n\\n.flex-container {\\n  display: flex;\\n  flex-flow: column nowrap;\\n  justify-content: space-between;\\n  align-items: center;\\n}\\n\\n.title {\\n  font-family: var(--garamond);\\n  font-size: clamp(35px, 20px + 4vw, 60px);\\n  color: var(--black);\\n  font-weight: 500;\\n  margin-bottom: 1.5rem;\\n}\\n\\np.date {\\n  color: var(--disabled);\\n  font-family: var(--garamond);\\n  font-size: 1rem;\\n}\\n\\np.excerpt {\\n  margin-top: 1rem;\\n  font-family: var(--openSans);\\n  color: #4d4d4d;\\n  font-size: 1rem;\\n}\\n\\na.read-more {\\n  font-size: 1rem;\\n  font-family: var(--openSans);\\n  color: var(--primary-300);\\n  font-weight: 600;\\n}\\na.read-more:hover {\\n  color: var(--primary-200);\\n}</style>\\r\\n"],"names":[],"mappings":"AAkDmB,EAAE,8BAAC,CAAC,AACrB,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,KAAK,CAChB,WAAW,CAAE,CAAC,CAAC,CAAC,CAChB,MAAM,CAAE,CAAC,AACX,CAAC,AAED,EAAE,8BAAC,CAAC,AACF,MAAM,CAAE,IAAI,CACZ,eAAe,CAAE,IAAI,CACrB,eAAe,CAAE,IAAI,CACrB,OAAO,CAAE,IAAI,CACb,SAAS,CAAE,MAAM,CAAC,MAAM,CACxB,eAAe,CAAE,YAAY,CAC7B,WAAW,CAAE,MAAM,CACnB,aAAa,CAAE,IAAI,AACrB,CAAC,AACD,iBAAE,CAAC,CAAC,eAAC,CAAC,AACJ,eAAe,CAAE,IAAI,CACrB,SAAS,CAAE,IAAI,AACjB,CAAC,AACD,iBAAE,CAAC,gBAAC,MAAM,CACV,iBAAE,CAAC,gBAAC,MAAM,CACV,iBAAE,CAAC,gBAAC,OAAO,AAAC,CAAC,AACX,eAAe,CAAE,IAAI,CACrB,KAAK,CAAE,OAAO,AAChB,CAAC,AAED,QAAQ,8BAAC,CAAC,AACR,aAAa,CAAE,CAAC,CAChB,WAAW,CAAE,CAAC,CAAC,CAAC,CAChB,UAAU,CAAE,MAAM,AACpB,CAAC,AAED,MAAM,8BAAC,CAAC,AACN,UAAU,CAAE,WAAW,CACvB,OAAO,CAAE,IAAI,CACb,MAAM,CAAE,IAAI,CACZ,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,MAAM,CAAE,CAAC,CAAC,IAAI,CACd,KAAK,CAAE,IAAI,UAAU,CAAC,CACtB,UAAU,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CAC1B,MAAM,CAAE,OAAO,AACjB,CAAC,AACD,oCAAM,MAAM,AAAC,CAAC,AACZ,KAAK,CAAE,IAAI,aAAa,CAAC,CACzB,eAAe,CAAE,SAAS,AAC5B,CAAC,AAED,MAAM,SAAS,8BAAC,CAAC,AACf,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AAED,eAAe,8BAAC,CAAC,AACf,OAAO,CAAE,IAAI,CACb,SAAS,CAAE,MAAM,CAAC,MAAM,CACxB,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,MAAM,AACrB,CAAC,AAED,MAAM,8BAAC,CAAC,AACN,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,MAAM,IAAI,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,GAAG,CAAC,CAAC,IAAI,CAAC,CACxC,KAAK,CAAE,IAAI,OAAO,CAAC,CACnB,WAAW,CAAE,GAAG,CAChB,aAAa,CAAE,MAAM,AACvB,CAAC,AAED,CAAC,KAAK,8BAAC,CAAC,AACN,KAAK,CAAE,IAAI,UAAU,CAAC,CACtB,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,IAAI,AACjB,CAAC,AAED,CAAC,QAAQ,8BAAC,CAAC,AACT,UAAU,CAAE,IAAI,CAChB,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,KAAK,CAAE,OAAO,CACd,SAAS,CAAE,IAAI,AACjB,CAAC,AAED,CAAC,UAAU,8BAAC,CAAC,AACX,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,KAAK,CAAE,IAAI,aAAa,CAAC,CACzB,WAAW,CAAE,GAAG,AAClB,CAAC,AACD,CAAC,wCAAU,MAAM,AAAC,CAAC,AACjB,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC"}`
};
const Articles = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $globalSize, $$unsubscribe_globalSize;
  let {articles} = $$props;
  createEventDispatcher();
  let {buttonSelection} = $$props;
  let {loadingContent} = $$props;
  let globalSize = getContext("size");
  $$unsubscribe_globalSize = subscribe(globalSize, (value) => $globalSize = value);
  if ($$props.articles === void 0 && $$bindings.articles && articles !== void 0)
    $$bindings.articles(articles);
  if ($$props.buttonSelection === void 0 && $$bindings.buttonSelection && buttonSelection !== void 0)
    $$bindings.buttonSelection(buttonSelection);
  if ($$props.loadingContent === void 0 && $$bindings.loadingContent && loadingContent !== void 0)
    $$bindings.loadingContent(loadingContent);
  $$result.css.add(css$4);
  {
    console.log($globalSize);
  }
  $$unsubscribe_globalSize();
  return `<div class="${"buttons svelte-1adtjx4"}"><button class="${["svelte-1adtjx4", buttonSelection == "recent" ? "selected" : ""].join(" ").trim()}">Newest</button>
  <button class="${["svelte-1adtjx4", buttonSelection == "favourite" ? "selected" : ""].join(" ").trim()}">Start Here</button></div>

${!loadingContent ? `<ul class="${"svelte-1adtjx4"}">${each(articles, (post2, i) => `<li class="${"svelte-1adtjx4"}"><div class="${"flex-container svelte-1adtjx4"}"><p class="${"date svelte-1adtjx4"}">${escape(post2.created_at)}</p>
             <a href="${"./posts/" + escape(post2.slug)}" class="${"title svelte-1adtjx4"}">${escape(post2.title)}</a></div>
           ${buttonSelection == "favourite" ? `${validate_component(Badges, "Badges").$$render($$result, {favBadge: "true"}, {}, {})}` : `${validate_component(Badges, "Badges").$$render($$result, {tags: post2.tags}, {}, {})}`}
           <p class="${"excerpt svelte-1adtjx4"}">${escape(post2.excerpt)}
             <a href="${"./posts/" + escape(post2.slug)}" class="${"read-more svelte-1adtjx4"}">read more</a></p>
         </li>`)}</ul>` : ``}`;
});
var LoadingSpinner_svelte = ".spinner.svelte-1unbn1h.svelte-1unbn1h{position:absolute;top:0;left:0;right:0;bottom:0;display:grid;place-items:center}.lds-ellipsis.svelte-1unbn1h.svelte-1unbn1h{transform:translateY(-200%);display:inline-block;position:relative;width:80px;height:80px}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h{position:absolute;top:33px;width:13px;height:13px;border-radius:50%;background:var(--primary-200);animation-timing-function:cubic-bezier(0, 1, 1, 0)}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(1){left:8px;animation:svelte-1unbn1h-lds-ellipsis1 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(2){left:8px;animation:svelte-1unbn1h-lds-ellipsis2 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(3){left:32px;animation:svelte-1unbn1h-lds-ellipsis2 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(4){left:56px;animation:svelte-1unbn1h-lds-ellipsis3 0.6s infinite}@keyframes svelte-1unbn1h-lds-ellipsis1{0%{transform:scale(0)}100%{transform:scale(1)}}@keyframes svelte-1unbn1h-lds-ellipsis3{0%{transform:scale(1)}100%{transform:scale(0)}}@keyframes svelte-1unbn1h-lds-ellipsis2{0%{transform:translate(0, 0)}100%{transform:translate(24px, 0)}}";
const css$3 = {
  code: ".spinner.svelte-1unbn1h.svelte-1unbn1h{position:absolute;top:0;left:0;right:0;bottom:0;display:grid;place-items:center}.lds-ellipsis.svelte-1unbn1h.svelte-1unbn1h{transform:translateY(-200%);display:inline-block;position:relative;width:80px;height:80px}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h{position:absolute;top:33px;width:13px;height:13px;border-radius:50%;background:var(--primary-200);animation-timing-function:cubic-bezier(0, 1, 1, 0)}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(1){left:8px;animation:svelte-1unbn1h-lds-ellipsis1 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(2){left:8px;animation:svelte-1unbn1h-lds-ellipsis2 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(3){left:32px;animation:svelte-1unbn1h-lds-ellipsis2 0.6s infinite}.lds-ellipsis.svelte-1unbn1h div.svelte-1unbn1h:nth-child(4){left:56px;animation:svelte-1unbn1h-lds-ellipsis3 0.6s infinite}@keyframes svelte-1unbn1h-lds-ellipsis1{0%{transform:scale(0)}100%{transform:scale(1)}}@keyframes svelte-1unbn1h-lds-ellipsis3{0%{transform:scale(1)}100%{transform:scale(0)}}@keyframes svelte-1unbn1h-lds-ellipsis2{0%{transform:translate(0, 0)}100%{transform:translate(24px, 0)}}",
  map: '{"version":3,"file":"LoadingSpinner.svelte","sources":["LoadingSpinner.svelte"],"sourcesContent":["<div class=\\"spinner\\">\\r\\n  <div class=\\"lds-ellipsis\\">\\r\\n    <div />\\r\\n    <div />\\r\\n    <div />\\r\\n    <div />\\r\\n  </div>\\r\\n</div>\\r\\n\\r\\n<style>\\r\\n\\r\\n  .spinner {\\r\\n    position: absolute;\\r\\n    top:0;\\r\\n    left: 0;\\r\\n    right: 0;\\r\\n    bottom: 0;\\r\\n    display: grid;\\r\\n    place-items: center;\\r\\n  }\\r\\n\\r\\n  .lds-ellipsis {\\r\\n    transform: translateY(-200%);\\r\\n    display: inline-block;\\r\\n    position: relative;\\r\\n    width: 80px;\\r\\n    height: 80px;\\r\\n  }\\r\\n  .lds-ellipsis div {\\r\\n    position: absolute;\\r\\n    top: 33px;\\r\\n    width: 13px;\\r\\n    height: 13px;\\r\\n    border-radius: 50%;\\r\\n    background: var(--primary-200);\\r\\n    animation-timing-function: cubic-bezier(0, 1, 1, 0);\\r\\n  }\\r\\n  .lds-ellipsis div:nth-child(1) {\\r\\n    left: 8px;\\r\\n    animation: lds-ellipsis1 0.6s infinite;\\r\\n  }\\r\\n  .lds-ellipsis div:nth-child(2) {\\r\\n    left: 8px;\\r\\n    animation: lds-ellipsis2 0.6s infinite;\\r\\n  }\\r\\n  .lds-ellipsis div:nth-child(3) {\\r\\n    left: 32px;\\r\\n    animation: lds-ellipsis2 0.6s infinite;\\r\\n  }\\r\\n  .lds-ellipsis div:nth-child(4) {\\r\\n    left: 56px;\\r\\n    animation: lds-ellipsis3 0.6s infinite;\\r\\n  }\\r\\n  @keyframes lds-ellipsis1 {\\r\\n    0% {\\r\\n      transform: scale(0);\\r\\n    }\\r\\n    100% {\\r\\n      transform: scale(1);\\r\\n    }\\r\\n  }\\r\\n  @keyframes lds-ellipsis3 {\\r\\n    0% {\\r\\n      transform: scale(1);\\r\\n    }\\r\\n    100% {\\r\\n      transform: scale(0);\\r\\n    }\\r\\n  }\\r\\n  @keyframes lds-ellipsis2 {\\r\\n    0% {\\r\\n      transform: translate(0, 0);\\r\\n    }\\r\\n    100% {\\r\\n      transform: translate(24px, 0);\\r\\n    }\\r\\n  }\\r\\n</style>\\r\\n"],"names":[],"mappings":"AAWE,QAAQ,8BAAC,CAAC,AACR,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAC,CACL,IAAI,CAAE,CAAC,CACP,KAAK,CAAE,CAAC,CACR,MAAM,CAAE,CAAC,CACT,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,AACrB,CAAC,AAED,aAAa,8BAAC,CAAC,AACb,SAAS,CAAE,WAAW,KAAK,CAAC,CAC5B,OAAO,CAAE,YAAY,CACrB,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,AACd,CAAC,AACD,4BAAa,CAAC,GAAG,eAAC,CAAC,AACjB,QAAQ,CAAE,QAAQ,CAClB,GAAG,CAAE,IAAI,CACT,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,aAAa,CAAE,GAAG,CAClB,UAAU,CAAE,IAAI,aAAa,CAAC,CAC9B,yBAAyB,CAAE,aAAa,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,AACrD,CAAC,AACD,4BAAa,CAAC,kBAAG,WAAW,CAAC,CAAC,AAAC,CAAC,AAC9B,IAAI,CAAE,GAAG,CACT,SAAS,CAAE,4BAAa,CAAC,IAAI,CAAC,QAAQ,AACxC,CAAC,AACD,4BAAa,CAAC,kBAAG,WAAW,CAAC,CAAC,AAAC,CAAC,AAC9B,IAAI,CAAE,GAAG,CACT,KAAK,IAAI,CAAE,4BAAa,CAAC,IAAI,CAAC,QAAQ,AACxC,CAAC,AACD,4BAAa,CAAC,kBAAG,WAAW,CAAC,CAAC,AAAC,CAAC,AAC9B,IAAI,CAAE,IAAI,CACV,IAAI,KAAK,CAAE,4BAAa,CAAC,IAAI,CAAC,QAAQ,AACxC,CAAC,AACD,4BAAa,CAAC,kBAAG,WAAW,CAAC,CAAC,AAAC,CAAC,AAC9B,IAAI,CAAE,IAAI,CACV,GAAG,MAAM,CAAE,4BAAa,CAAC,IAAI,CAAC,QAAQ,AACxC,CAAC,AACD,WAAW,4BAAc,CAAC,AACxB,EAAE,AAAC,CAAC,AACF,SAAS,CAAE,GAAG,GAAG,CAAC,CAAC,AACrB,CAAC,AACD,IAAI,AAAC,CAAC,AACJ,SAAS,CAAE,MAAM,CAAC,CAAC,AACrB,CAAC,AACH,CAAC,AACD,WAAW,4BAAc,CAAC,AACxB,EAAE,AAAC,CAAC,AACF,SAAS,CAAE,MAAM,CAAC,CAAC,AACrB,CAAC,AACD,IAAI,AAAC,CAAC,AACJ,SAAS,CAAE,MAAM,CAAC,CAAC,AACrB,CAAC,AACH,CAAC,AACD,WAAW,4BAAc,CAAC,AACxB,EAAE,AAAC,CAAC,AACF,SAAS,CAAE,UAAU,CAAC,CAAC,CAAC,CAAC,CAAC,AAC5B,CAAC,AACD,IAAI,AAAC,CAAC,AACJ,SAAS,CAAE,UAAU,IAAI,CAAC,CAAC,CAAC,CAAC,AAC/B,CAAC,AACH,CAAC"}'
};
const LoadingSpinner = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css$3);
  return `<div class="${"spinner svelte-1unbn1h"}"><div class="${"lds-ellipsis svelte-1unbn1h"}"><div class="${"svelte-1unbn1h"}"></div>
    <div class="${"svelte-1unbn1h"}"></div>
    <div class="${"svelte-1unbn1h"}"></div>
    <div class="${"svelte-1unbn1h"}"></div></div>
</div>`;
});
const Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $articleStore, $$unsubscribe_articleStore;
  $$unsubscribe_articleStore = subscribe(customArticleStore, (value) => $articleStore = value);
  let loadingContent = true;
  let buttonSelection = "recent";
  function turnOffSpinnerAfterPageLoad() {
    setTimeout(() => {
      loadingContent = false;
    }, 650);
  }
  turnOffSpinnerAfterPageLoad();
  customArticleStore.updateRecentArticles();
  $$unsubscribe_articleStore();
  return `${loadingContent ? `${validate_component(LoadingSpinner, "Spinner").$$render($$result, {}, {}, {})}` : ``}
${validate_component(Articles, "Articles").$$render($$result, {
    articles: $articleStore,
    buttonSelection,
    loadingContent
  }, {}, {})}`;
});
var index = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Routes
});
const MainSite = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<p>this is the space for the main website!</p>`;
});
var mainSite = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: MainSite
});
const Contact = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<p>contact moi</p>`;
});
var contact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Contact
});
const About = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<p>testing</p>`;
});
var about = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: About
});
var _slug__svelte = ".post-container.svelte-8x68mz{grid-column:2/3}.post-container.svelte-8x68mz p{font-family:var(--openSans);font-size:calc(1rem + 1px);margin:1rem 0;text-align:left}.post-container.svelte-8x68mz h1{font-family:var(--garamond);font-size:3rem}.post-container.svelte-8x68mz figure{width:100%}.post-container.svelte-8x68mz img{width:100%;height:auto}";
const css$2 = {
  code: ".post-container.svelte-8x68mz{grid-column:2/3}.post-container.svelte-8x68mz p{font-family:var(--openSans);font-size:calc(1rem + 1px);margin:1rem 0;text-align:left}.post-container.svelte-8x68mz h1{font-family:var(--garamond);font-size:3rem}.post-container.svelte-8x68mz figure{width:100%}.post-container.svelte-8x68mz img{width:100%;height:auto}",
  map: `{"version":3,"file":"[slug].svelte","sources":["[slug].svelte"],"sourcesContent":["<script context=\\"module\\">\\r\\n\\timport GhostContentAPI from '@tryghost/content-api'\\r\\n\\texport async function load(ctx){\\r\\n\\t\\tconst api = new GhostContentAPI({\\r\\n            url: \\"https://testing-svelte.ghost.io\\",\\r\\n            key: \\"23602dc86c8aeea22d4d64ef3a\\",\\r\\n            version: \\"v3\\",\\r\\n\\t\\t})\\r\\n        let slug = ctx.page.params.slug\\r\\n\\t\\ttry {\\r\\n\\t\\t\\tconst post = await api.posts.read({slug},{formats: ['html']})\\r\\n\\t\\t\\treturn {props: {\\"post\\": post}}\\r\\n\\t\\t} catch(err) {\\r\\n\\t\\t\\tconsole.log(err)\\r\\n\\t\\t}\\r\\n\\t}\\r\\n</script>\\r\\n\\r\\n<script>\\r\\n\\texport let post;\\r\\n</script>\\r\\n\\r\\n<div class=\\"post-container\\">\\r\\n\\t<h1>{post.title}</h1>\\r\\n\\t{@html post.html}\\r\\n</div>\\r\\n\\r\\n<style lang=\\"scss\\">.post-container {\\n  grid-column: 2/3;\\n}\\n\\n.post-container :global(p) {\\n  font-family: var(--openSans);\\n  font-size: calc(1rem + 1px);\\n  margin: 1rem 0;\\n  text-align: left;\\n}\\n.post-container :global(h1) {\\n  font-family: var(--garamond);\\n  font-size: 3rem;\\n}\\n.post-container :global(figure) {\\n  width: 100%;\\n}\\n.post-container :global(img) {\\n  width: 100%;\\n  height: auto;\\n}</style>"],"names":[],"mappings":"AA2BmB,eAAe,cAAC,CAAC,AAClC,WAAW,CAAE,CAAC,CAAC,CAAC,AAClB,CAAC,AAED,6BAAe,CAAC,AAAQ,CAAC,AAAE,CAAC,AAC1B,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,KAAK,IAAI,CAAC,CAAC,CAAC,GAAG,CAAC,CAC3B,MAAM,CAAE,IAAI,CAAC,CAAC,CACd,UAAU,CAAE,IAAI,AAClB,CAAC,AACD,6BAAe,CAAC,AAAQ,EAAE,AAAE,CAAC,AAC3B,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,IAAI,AACjB,CAAC,AACD,6BAAe,CAAC,AAAQ,MAAM,AAAE,CAAC,AAC/B,KAAK,CAAE,IAAI,AACb,CAAC,AACD,6BAAe,CAAC,AAAQ,GAAG,AAAE,CAAC,AAC5B,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,AACd,CAAC"}`
};
async function load(ctx) {
  const api = new GhostContentAPI({
    url: "https://testing-svelte.ghost.io",
    key: "23602dc86c8aeea22d4d64ef3a",
    version: "v3"
  });
  let slug = ctx.page.params.slug;
  try {
    const post2 = await api.posts.read({slug}, {formats: ["html"]});
    return {props: {post: post2}};
  } catch (err) {
    console.log(err);
  }
}
const U5Bslugu5D = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {post: post2} = $$props;
  if ($$props.post === void 0 && $$bindings.post && post2 !== void 0)
    $$bindings.post(post2);
  $$result.css.add(css$2);
  return `<div class="${"post-container svelte-8x68mz"}"><h1>${escape(post2.title)}</h1>
	${post2.html}
</div>`;
});
var _slug_ = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: U5Bslugu5D,
  load
});
var Header_svelte = "header.svelte-1p68w3m.svelte-1p68w3m{width:100%;max-width:1110px;margin:auto;height:100px;padding:20px;display:flex;flex-flow:row nowrap;justify-content:space-between;align-items:center}.logo.svelte-1p68w3m.svelte-1p68w3m{font-family:var(--cinzel);font-size:17.5px;font-weight:700;color:var(--primary-200);transition:color 250ms ease}.logo.svelte-1p68w3m span.big-letter.svelte-1p68w3m{font-size:22.5px}.logo.svelte-1p68w3m span.light-font.svelte-1p68w3m{color:var(--primary-100)}.logo.svelte-1p68w3m.svelte-1p68w3m:hover{color:var(--primary-100)}.logo.svelte-1p68w3m:hover span.light-font.svelte-1p68w3m{color:var(--primary-200)}.button.svelte-1p68w3m.svelte-1p68w3m{z-index:100;width:25px;height:25px;background:var(--primary-100);cursor:pointer;transition:all 750ms ease;position:relative}.button.tablet.svelte-1p68w3m.svelte-1p68w3m,.button.desktop.svelte-1p68w3m.svelte-1p68w3m{display:none}.button.clicked.svelte-1p68w3m.svelte-1p68w3m{transform:rotate(225deg);border-radius:50%;background:var(--primary-300)}.button.clicked.svelte-1p68w3m .span-container span.svelte-1p68w3m{opacity:1}.button.svelte-1p68w3m .span-container.svelte-1p68w3m{width:80%;height:80%;display:grid;place-items:center;position:absolute;left:0;right:0;top:0;bottom:0;transform:translate(10%, 12%)}.button.svelte-1p68w3m .span-container span.svelte-1p68w3m{position:absolute;width:80%;height:2px;background:white;opacity:0;transition:opacity 300ms ease}.button.svelte-1p68w3m .span-container span.svelte-1p68w3m:nth-child(1){transform:rotate(90deg)}nav.svelte-1p68w3m.svelte-1p68w3m{position:absolute;top:0;right:0;bottom:0;background:var(--primary-200);height:100vh;width:250px;display:flex;flex-flow:column nowrap;align-items:center;justify-content:center;transform:translateX(150%);transition:transform 250ms ease;z-index:50}nav.tablet.svelte-1p68w3m.svelte-1p68w3m,nav.desktop.svelte-1p68w3m.svelte-1p68w3m{transform:translateX(0);background:transparent;position:static;width:auto;height:100%;flex-flow:row nowrap;align-items:center;justify-content:flex-end}.button.mobile.clicked.svelte-1p68w3m~nav.svelte-1p68w3m{transform:translateX(0%)}nav.svelte-1p68w3m a.svelte-1p68w3m{text-decoration:none;font-family:var(--garamond);font-size:22px;color:white;transition:color 250ms ease}nav.svelte-1p68w3m a.svelte-1p68w3m:hover{color:var(--primary-300)}nav.mobile.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)){margin-bottom:0.7rem}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)),nav.desktop.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)){margin-bottom:0;margin-right:1.4rem}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m,nav.desktop.svelte-1p68w3m a.svelte-1p68w3m{color:var(--primary-200)}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m:hover,nav.desktop.svelte-1p68w3m a.svelte-1p68w3m:hover{color:var(--primary-300);text-decoration:underline}";
const css$1 = {
  code: "header.svelte-1p68w3m.svelte-1p68w3m{width:100%;max-width:1110px;margin:auto;height:100px;padding:20px;display:flex;flex-flow:row nowrap;justify-content:space-between;align-items:center}.logo.svelte-1p68w3m.svelte-1p68w3m{font-family:var(--cinzel);font-size:17.5px;font-weight:700;color:var(--primary-200);transition:color 250ms ease}.logo.svelte-1p68w3m span.big-letter.svelte-1p68w3m{font-size:22.5px}.logo.svelte-1p68w3m span.light-font.svelte-1p68w3m{color:var(--primary-100)}.logo.svelte-1p68w3m.svelte-1p68w3m:hover{color:var(--primary-100)}.logo.svelte-1p68w3m:hover span.light-font.svelte-1p68w3m{color:var(--primary-200)}.button.svelte-1p68w3m.svelte-1p68w3m{z-index:100;width:25px;height:25px;background:var(--primary-100);cursor:pointer;transition:all 750ms ease;position:relative}.button.tablet.svelte-1p68w3m.svelte-1p68w3m,.button.desktop.svelte-1p68w3m.svelte-1p68w3m{display:none}.button.clicked.svelte-1p68w3m.svelte-1p68w3m{transform:rotate(225deg);border-radius:50%;background:var(--primary-300)}.button.clicked.svelte-1p68w3m .span-container span.svelte-1p68w3m{opacity:1}.button.svelte-1p68w3m .span-container.svelte-1p68w3m{width:80%;height:80%;display:grid;place-items:center;position:absolute;left:0;right:0;top:0;bottom:0;transform:translate(10%, 12%)}.button.svelte-1p68w3m .span-container span.svelte-1p68w3m{position:absolute;width:80%;height:2px;background:white;opacity:0;transition:opacity 300ms ease}.button.svelte-1p68w3m .span-container span.svelte-1p68w3m:nth-child(1){transform:rotate(90deg)}nav.svelte-1p68w3m.svelte-1p68w3m{position:absolute;top:0;right:0;bottom:0;background:var(--primary-200);height:100vh;width:250px;display:flex;flex-flow:column nowrap;align-items:center;justify-content:center;transform:translateX(150%);transition:transform 250ms ease;z-index:50}nav.tablet.svelte-1p68w3m.svelte-1p68w3m,nav.desktop.svelte-1p68w3m.svelte-1p68w3m{transform:translateX(0);background:transparent;position:static;width:auto;height:100%;flex-flow:row nowrap;align-items:center;justify-content:flex-end}.button.mobile.clicked.svelte-1p68w3m~nav.svelte-1p68w3m{transform:translateX(0%)}nav.svelte-1p68w3m a.svelte-1p68w3m{text-decoration:none;font-family:var(--garamond);font-size:22px;color:white;transition:color 250ms ease}nav.svelte-1p68w3m a.svelte-1p68w3m:hover{color:var(--primary-300)}nav.mobile.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)){margin-bottom:0.7rem}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)),nav.desktop.svelte-1p68w3m a.svelte-1p68w3m:not(:nth-last-child(1)){margin-bottom:0;margin-right:1.4rem}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m,nav.desktop.svelte-1p68w3m a.svelte-1p68w3m{color:var(--primary-200)}nav.tablet.svelte-1p68w3m a.svelte-1p68w3m:hover,nav.desktop.svelte-1p68w3m a.svelte-1p68w3m:hover{color:var(--primary-300);text-decoration:underline}",
  map: `{"version":3,"file":"Header.svelte","sources":["Header.svelte"],"sourcesContent":["<script>\\r\\n  import { createEventDispatcher } from \\"svelte\\";\\r\\n  import {getContext} from 'svelte';\\r\\n  const dispatch = createEventDispatcher();\\r\\n  \\r\\n  let size = getContext('size')\\r\\n\\r\\n  // import {fade} from 'svelte/transition';\\r\\n  let buttonClicked = false;\\r\\n\\r\\n  function toggleClickState() {\\r\\n    buttonClicked = !buttonClicked;\\r\\n  }\\r\\n</script>\\r\\n\\r\\n<header class={$size}>\\r\\n  <a class=\\"logo\\" href=\\"/\\">\\r\\n    <span class=\\"big-letter\\">H</span>appy<span class=\\"big-letter\\">M</span\\r\\n    >ystic<span class=\\"light-font\\"><span class=\\"big-letter\\">B</span>log</span>\\r\\n  </a>\\r\\n  <div class=\\"button {$size}\\" class:clicked={buttonClicked} on:click={toggleClickState}>\\r\\n    <div class=\\"span-container\\">\\r\\n      <span />\\r\\n      <span />\\r\\n    </div>\\r\\n  </div>\\r\\n  <!-- {#if buttonClicked} -->\\r\\n  <nav class=\\"{$size}\\">\\r\\n    <a\\r\\n      href=\\"/\\"\\r\\n      on:click={toggleClickState}\\r\\n      on:click={() => dispatch(\\"loader\\", \\"recent\\")}>Blog</a\\r\\n    >\\r\\n    <a\\r\\n      href=\\"/about\\"\\r\\n      on:click={toggleClickState}\\r\\n      on:click={() => dispatch(\\"loader\\", \\"recent\\")}>About</a\\r\\n    >\\r\\n    <a\\r\\n      href=\\"/contact\\"\\r\\n      on:click={toggleClickState}\\r\\n      on:click={() => dispatch(\\"loader\\", \\"recent\\")}>Contact</a\\r\\n    >\\r\\n    <a\\r\\n      href=\\"/mainSite\\"\\r\\n      on:click={toggleClickState}\\r\\n      on:click={() => dispatch(\\"loader\\", \\"recent\\")}>Coaching</a\\r\\n    >\\r\\n  </nav>\\r\\n  <!-- {/if} -->\\r\\n</header>\\r\\n\\r\\n<style lang=\\"scss\\">header {\\n  width: 100%;\\n  max-width: 1110px;\\n  margin: auto;\\n  height: 100px;\\n  padding: 20px;\\n  display: flex;\\n  flex-flow: row nowrap;\\n  justify-content: space-between;\\n  align-items: center;\\n}\\n\\n.logo {\\n  font-family: var(--cinzel);\\n  font-size: 17.5px;\\n  font-weight: 700;\\n  color: var(--primary-200);\\n  transition: color 250ms ease;\\n}\\n\\n.logo span.big-letter {\\n  font-size: 22.5px;\\n}\\n\\n.logo span.light-font {\\n  color: var(--primary-100);\\n}\\n\\n.logo:hover {\\n  color: var(--primary-100);\\n}\\n.logo:hover span.light-font {\\n  color: var(--primary-200);\\n}\\n\\n.button {\\n  z-index: 100;\\n  width: 25px;\\n  height: 25px;\\n  background: var(--primary-100);\\n  cursor: pointer;\\n  transition: all 750ms ease;\\n  position: relative;\\n  /* display: grid;\\n      place-items:center; */\\n}\\n\\n.button.tablet, .button.desktop {\\n  display: none;\\n}\\n\\n.button.clicked {\\n  transform: rotate(225deg);\\n  border-radius: 50%;\\n  background: var(--primary-300);\\n}\\n.button.clicked .span-container span {\\n  opacity: 1;\\n}\\n\\n.button .span-container {\\n  width: 80%;\\n  height: 80%;\\n  display: grid;\\n  place-items: center;\\n  position: absolute;\\n  left: 0;\\n  right: 0;\\n  top: 0;\\n  bottom: 0;\\n  transform: translate(10%, 12%);\\n}\\n\\n.button .span-container span {\\n  position: absolute;\\n  width: 80%;\\n  height: 2px;\\n  background: white;\\n  opacity: 0;\\n  transition: opacity 300ms ease;\\n}\\n.button .span-container span:nth-child(1) {\\n  transform: rotate(90deg);\\n}\\n\\nnav {\\n  position: absolute;\\n  top: 0;\\n  right: 0;\\n  bottom: 0;\\n  background: var(--primary-200);\\n  height: 100vh;\\n  width: 250px;\\n  display: flex;\\n  flex-flow: column nowrap;\\n  align-items: center;\\n  justify-content: center;\\n  transform: translateX(150%);\\n  transition: transform 250ms ease;\\n  z-index: 50;\\n}\\n\\nnav.tablet,\\nnav.desktop {\\n  transform: translateX(0);\\n  background: transparent;\\n  position: static;\\n  width: auto;\\n  height: 100%;\\n  flex-flow: row nowrap;\\n  align-items: center;\\n  justify-content: flex-end;\\n}\\n\\n.button.mobile.clicked ~ nav {\\n  transform: translateX(0%);\\n}\\n\\nnav a {\\n  text-decoration: none;\\n  font-family: var(--garamond);\\n  font-size: 22px;\\n  color: white;\\n  transition: color 250ms ease;\\n}\\nnav a:hover {\\n  color: var(--primary-300);\\n}\\n\\nnav.mobile a:not(:nth-last-child(1)) {\\n  margin-bottom: 0.7rem;\\n}\\n\\nnav.tablet a:not(:nth-last-child(1)),\\nnav.desktop a:not(:nth-last-child(1)) {\\n  margin-bottom: 0;\\n  margin-right: 1.4rem;\\n}\\n\\nnav.tablet a, nav.desktop a {\\n  color: var(--primary-200);\\n}\\nnav.tablet a:hover, nav.desktop a:hover {\\n  color: var(--primary-300);\\n  text-decoration: underline;\\n}</style>\\r\\n"],"names":[],"mappings":"AAoDmB,MAAM,8BAAC,CAAC,AACzB,KAAK,CAAE,IAAI,CACX,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,IAAI,CACZ,MAAM,CAAE,KAAK,CACb,OAAO,CAAE,IAAI,CACb,OAAO,CAAE,IAAI,CACb,SAAS,CAAE,GAAG,CAAC,MAAM,CACrB,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,MAAM,AACrB,CAAC,AAED,KAAK,8BAAC,CAAC,AACL,WAAW,CAAE,IAAI,QAAQ,CAAC,CAC1B,SAAS,CAAE,MAAM,CACjB,WAAW,CAAE,GAAG,CAChB,KAAK,CAAE,IAAI,aAAa,CAAC,CACzB,UAAU,CAAE,KAAK,CAAC,KAAK,CAAC,IAAI,AAC9B,CAAC,AAED,oBAAK,CAAC,IAAI,WAAW,eAAC,CAAC,AACrB,SAAS,CAAE,MAAM,AACnB,CAAC,AAED,oBAAK,CAAC,IAAI,WAAW,eAAC,CAAC,AACrB,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AAED,mCAAK,MAAM,AAAC,CAAC,AACX,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AACD,oBAAK,MAAM,CAAC,IAAI,WAAW,eAAC,CAAC,AAC3B,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AAED,OAAO,8BAAC,CAAC,AACP,OAAO,CAAE,GAAG,CACZ,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,UAAU,CAAE,IAAI,aAAa,CAAC,CAC9B,MAAM,CAAE,OAAO,CACf,UAAU,CAAE,GAAG,CAAC,KAAK,CAAC,IAAI,CAC1B,QAAQ,CAAE,QAAQ,AAGpB,CAAC,AAED,OAAO,qCAAO,CAAE,OAAO,QAAQ,8BAAC,CAAC,AAC/B,OAAO,CAAE,IAAI,AACf,CAAC,AAED,OAAO,QAAQ,8BAAC,CAAC,AACf,SAAS,CAAE,OAAO,MAAM,CAAC,CACzB,aAAa,CAAE,GAAG,CAClB,UAAU,CAAE,IAAI,aAAa,CAAC,AAChC,CAAC,AACD,OAAO,uBAAQ,CAAC,eAAe,CAAC,IAAI,eAAC,CAAC,AACpC,OAAO,CAAE,CAAC,AACZ,CAAC,AAED,sBAAO,CAAC,eAAe,eAAC,CAAC,AACvB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,CACX,OAAO,CAAE,IAAI,CACb,WAAW,CAAE,MAAM,CACnB,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CAAC,CACP,KAAK,CAAE,CAAC,CACR,GAAG,CAAE,CAAC,CACN,MAAM,CAAE,CAAC,CACT,SAAS,CAAE,UAAU,GAAG,CAAC,CAAC,GAAG,CAAC,AAChC,CAAC,AAED,sBAAO,CAAC,eAAe,CAAC,IAAI,eAAC,CAAC,AAC5B,QAAQ,CAAE,QAAQ,CAClB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,CACX,UAAU,CAAE,KAAK,CACjB,OAAO,CAAE,CAAC,CACV,UAAU,CAAE,OAAO,CAAC,KAAK,CAAC,IAAI,AAChC,CAAC,AACD,sBAAO,CAAC,eAAe,CAAC,mBAAI,WAAW,CAAC,CAAC,AAAC,CAAC,AACzC,SAAS,CAAE,OAAO,KAAK,CAAC,AAC1B,CAAC,AAED,GAAG,8BAAC,CAAC,AACH,QAAQ,CAAE,QAAQ,CAClB,GAAG,CAAE,CAAC,CACN,KAAK,CAAE,CAAC,CACR,MAAM,CAAE,CAAC,CACT,UAAU,CAAE,IAAI,aAAa,CAAC,CAC9B,MAAM,CAAE,KAAK,CACb,KAAK,CAAE,KAAK,CACZ,OAAO,CAAE,IAAI,CACb,SAAS,CAAE,MAAM,CAAC,MAAM,CACxB,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,MAAM,CACvB,SAAS,CAAE,WAAW,IAAI,CAAC,CAC3B,UAAU,CAAE,SAAS,CAAC,KAAK,CAAC,IAAI,CAChC,OAAO,CAAE,EAAE,AACb,CAAC,AAED,GAAG,qCAAO,CACV,GAAG,QAAQ,8BAAC,CAAC,AACX,SAAS,CAAE,WAAW,CAAC,CAAC,CACxB,UAAU,CAAE,WAAW,CACvB,QAAQ,CAAE,MAAM,CAChB,KAAK,CAAE,IAAI,CACX,MAAM,CAAE,IAAI,CACZ,SAAS,CAAE,GAAG,CAAC,MAAM,CACrB,WAAW,CAAE,MAAM,CACnB,eAAe,CAAE,QAAQ,AAC3B,CAAC,AAED,OAAO,OAAO,uBAAQ,CAAG,GAAG,eAAC,CAAC,AAC5B,SAAS,CAAE,WAAW,EAAE,CAAC,AAC3B,CAAC,AAED,kBAAG,CAAC,CAAC,eAAC,CAAC,AACL,eAAe,CAAE,IAAI,CACrB,WAAW,CAAE,IAAI,UAAU,CAAC,CAC5B,SAAS,CAAE,IAAI,CACf,KAAK,CAAE,KAAK,CACZ,UAAU,CAAE,KAAK,CAAC,KAAK,CAAC,IAAI,AAC9B,CAAC,AACD,kBAAG,CAAC,gBAAC,MAAM,AAAC,CAAC,AACX,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AAED,GAAG,sBAAO,CAAC,gBAAC,KAAK,gBAAgB,CAAC,CAAC,CAAC,AAAC,CAAC,AACpC,aAAa,CAAE,MAAM,AACvB,CAAC,AAED,GAAG,sBAAO,CAAC,gBAAC,KAAK,gBAAgB,CAAC,CAAC,CAAC,CACpC,GAAG,uBAAQ,CAAC,gBAAC,KAAK,gBAAgB,CAAC,CAAC,CAAC,AAAC,CAAC,AACrC,aAAa,CAAE,CAAC,CAChB,YAAY,CAAE,MAAM,AACtB,CAAC,AAED,GAAG,sBAAO,CAAC,gBAAC,CAAE,GAAG,uBAAQ,CAAC,CAAC,eAAC,CAAC,AAC3B,KAAK,CAAE,IAAI,aAAa,CAAC,AAC3B,CAAC,AACD,GAAG,sBAAO,CAAC,gBAAC,MAAM,CAAE,GAAG,uBAAQ,CAAC,gBAAC,MAAM,AAAC,CAAC,AACvC,KAAK,CAAE,IAAI,aAAa,CAAC,CACzB,eAAe,CAAE,SAAS,AAC5B,CAAC"}`
};
const Header = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $size, $$unsubscribe_size;
  createEventDispatcher();
  let size = getContext("size");
  $$unsubscribe_size = subscribe(size, (value) => $size = value);
  $$result.css.add(css$1);
  $$unsubscribe_size();
  return `<header class="${escape(null_to_empty($size)) + " svelte-1p68w3m"}"><a class="${"logo svelte-1p68w3m"}" href="${"/"}"><span class="${"big-letter svelte-1p68w3m"}">H</span>appy<span class="${"big-letter svelte-1p68w3m"}">M</span>ystic<span class="${"light-font svelte-1p68w3m"}"><span class="${"big-letter svelte-1p68w3m"}">B</span>log</span></a>
  <div class="${["button " + escape($size) + " svelte-1p68w3m", ""].join(" ").trim()}"><div class="${"span-container svelte-1p68w3m"}"><span class="${"svelte-1p68w3m"}"></span>
      <span class="${"svelte-1p68w3m"}"></span></div></div>
  
  <nav class="${escape(null_to_empty($size)) + " svelte-1p68w3m"}"><a href="${"/"}" class="${"svelte-1p68w3m"}">Blog</a>
    <a href="${"/about"}" class="${"svelte-1p68w3m"}">About</a>
    <a href="${"/contact"}" class="${"svelte-1p68w3m"}">Contact</a>
    <a href="${"/mainSite"}" class="${"svelte-1p68w3m"}">Coaching</a></nav>
  
</header>`;
});
const Footer = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<p>Copyright 2021 - Rafal Popisz</p>`;
});
var app = '@import url("https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800&display=swap");\n:root, body, * {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n:root {\n  --primary-300: #B67C78;\n  --primary-200: #D2A19D;\n  --primary-100: #F2CBC8;\n  --disabled: #BBBBBB;\n  --black: #060606;\n  --cinzel: "Cinzel Decorative", cursive;\n  --garamond: "Cormorant Garamond", serif;\n  --openSans: "Open Sans", sans-serif;\n}\nbody {\n  height: 100vh;\n  overflow-x: hidden;\n  background: #ffe8e6;\n}\nbody #svelte {\n  height: 100%;\n}\na {\n  text-decoration: none;\n}';
var $layout_svelte = "main.svelte-1isep8{text-align:center;padding:1em;margin:0 auto;height:100%;position:relative;display:grid;grid-template-columns:24px 1fr 24px;grid-template-rows:60px 1fr;grid-auto-columns:min-content;justify-content:space-between;align-items:start;row-gap:1rem}@media screen and (min-width: 768px){main.svelte-1isep8{grid-template-columns:40px 1fr 40px}}@media screen and (min-width: 600px){main.svelte-1isep8{grid-template-columns:40px 1fr 40px}}@media screen and (min-width: 650px){main.svelte-1isep8{grid-template-columns:1fr minmax(650px, 700px) 1fr;grid-template-rows:60px 1fr}}";
const css = {
  code: "main.svelte-1isep8{text-align:center;padding:1em;margin:0 auto;height:100%;position:relative;display:grid;grid-template-columns:24px 1fr 24px;grid-template-rows:60px 1fr;grid-auto-columns:min-content;justify-content:space-between;align-items:start;row-gap:1rem}@media screen and (min-width: 768px){main.svelte-1isep8{grid-template-columns:40px 1fr 40px}}@media screen and (min-width: 600px){main.svelte-1isep8{grid-template-columns:40px 1fr 40px}}@media screen and (min-width: 650px){main.svelte-1isep8{grid-template-columns:1fr minmax(650px, 700px) 1fr;grid-template-rows:60px 1fr}}",
  map: `{"version":3,"file":"$layout.svelte","sources":["$layout.svelte"],"sourcesContent":["<script>\\n  import Header from \\"$lib/Header.svelte\\";\\n  import Footer from \\"$lib/Footer.svelte\\";\\n  import \\"../app.scss\\";\\n  import {setContext} from 'svelte';\\n  import {writable} from 'svelte/store';\\n\\n  let innerWidth;\\n\\n  let size = writable(\\"mobile\\");\\n\\n  $: if(innerWidth >= 1000){\\n    $size = \\"desktop\\"\\n  } else if (innerWidth >= 768){\\n    $size = \\"tablet\\"\\n  } else {\\n    $size = \\"mobile\\"\\n  }\\n\\n  setContext('size', size)\\n\\n</script>\\n\\n<svelte:window bind:innerWidth={innerWidth} />\\n\\n<Header />\\n<main>\\n  <slot />\\n</main>\\n<Footer />\\n\\n<style lang=\\"scss\\">main {\\n  text-align: center;\\n  padding: 1em;\\n  margin: 0 auto;\\n  height: 100%;\\n  position: relative;\\n  display: grid;\\n  grid-template-columns: 24px 1fr 24px;\\n  grid-template-rows: 60px 1fr;\\n  grid-auto-columns: min-content;\\n  justify-content: space-between;\\n  align-items: start;\\n  row-gap: 1rem;\\n}\\n@media screen and (min-width: 768px) {\\n  main {\\n    grid-template-columns: 40px 1fr 40px;\\n  }\\n}\\n@media screen and (min-width: 600px) {\\n  main {\\n    grid-template-columns: 40px 1fr 40px;\\n  }\\n}\\n@media screen and (min-width: 650px) {\\n  main {\\n    grid-template-columns: 1fr minmax(650px, 700px) 1fr;\\n    grid-template-rows: 60px 1fr;\\n  }\\n}</style>\\n"],"names":[],"mappings":"AA+BmB,IAAI,cAAC,CAAC,AACvB,UAAU,CAAE,MAAM,CAClB,OAAO,CAAE,GAAG,CACZ,MAAM,CAAE,CAAC,CAAC,IAAI,CACd,MAAM,CAAE,IAAI,CACZ,QAAQ,CAAE,QAAQ,CAClB,OAAO,CAAE,IAAI,CACb,qBAAqB,CAAE,IAAI,CAAC,GAAG,CAAC,IAAI,CACpC,kBAAkB,CAAE,IAAI,CAAC,GAAG,CAC5B,iBAAiB,CAAE,WAAW,CAC9B,eAAe,CAAE,aAAa,CAC9B,WAAW,CAAE,KAAK,CAClB,OAAO,CAAE,IAAI,AACf,CAAC,AACD,OAAO,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACpC,IAAI,cAAC,CAAC,AACJ,qBAAqB,CAAE,IAAI,CAAC,GAAG,CAAC,IAAI,AACtC,CAAC,AACH,CAAC,AACD,OAAO,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACpC,IAAI,cAAC,CAAC,AACJ,qBAAqB,CAAE,IAAI,CAAC,GAAG,CAAC,IAAI,AACtC,CAAC,AACH,CAAC,AACD,OAAO,MAAM,CAAC,GAAG,CAAC,YAAY,KAAK,CAAC,AAAC,CAAC,AACpC,IAAI,cAAC,CAAC,AACJ,qBAAqB,CAAE,GAAG,CAAC,OAAO,KAAK,CAAC,CAAC,KAAK,CAAC,CAAC,GAAG,CACnD,kBAAkB,CAAE,IAAI,CAAC,GAAG,AAC9B,CAAC,AACH,CAAC"}`
};
const $layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $size, $$unsubscribe_size;
  let size = writable("mobile");
  $$unsubscribe_size = subscribe(size, (value) => $size = value);
  setContext("size", size);
  $$result.css.add(css);
  {
    {
      set_store_value(size, $size = "mobile", $size);
    }
  }
  $$unsubscribe_size();
  return `

${validate_component(Header, "Header").$$render($$result, {}, {}, {})}
<main class="${"svelte-1isep8"}">${slots.default ? slots.default({}) : ``}</main>
${validate_component(Footer, "Footer").$$render($$result, {}, {}, {})}`;
});
var $layout$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: $layout
});
export {init, render};
