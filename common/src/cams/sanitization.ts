const MONGO_CONSOLE_INJECTED_PATTERN = RegExp(
  /\b(?:db\.[a-zA-Z]+|mongo\.[a-zA-Z]+|(?:find|insert|update|delete|aggregate|create|drop|remove|replace|count|distinct|mapReduce|save)\b\s*(?:\(|{))/i,
);
const JAVASCRIPT_INJECTED_PATTERN = RegExp(
  /<script\b[^>]*>[\s\S]*?<\/script>|fetch\s*\(.*?\)|eval\s*\(.*?\)|window\.[a-zA-Z_$][a-zA-Z0-9_$]*|document\.[a-zA-Z_$][a-zA-Z0-9_$]*/gi,
);
const MONGO_QUERY_INJECTED_PATTERN = RegExp(
  /\$(eq|ne|gt|gte|lt|lte|in|nin|and|or|not|regex|exists|type|mod|text|where|all|elemMatch|size)/,
);

export function isValidUserInput(input: string) {
  if (
    input.match(MONGO_CONSOLE_INJECTED_PATTERN) ||
    input.match(JAVASCRIPT_INJECTED_PATTERN) ||
    input.match(MONGO_QUERY_INJECTED_PATTERN)
  ) {
    return false;
  } else {
    return true;
  }
}
