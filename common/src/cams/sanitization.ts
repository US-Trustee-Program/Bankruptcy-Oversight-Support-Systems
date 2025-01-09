const MONGO_INJECTED_PATTERN = RegExp(
  /\b(?:db\.[a-zA-Z]+|mongo\.[a-zA-Z]+|(?:find|insert|update|delete|aggregate|create|drop|remove|replace|count|distinct|mapReduce|save)\b\s*(?:\(|{))/i,
);
const JAVASCRIPT_INJECTED_PATTERN = RegExp(
  /\b(?:eval|Function|with|document\.|window\.|alert|prompt|confirm|fetch\s*\(|setTimeout|setInterval)|<script[\s\S]*?>[\s\S]*?<\/script>/i,
);

export function isValidUserInput(input: string) {
  if (input.match(MONGO_INJECTED_PATTERN) || input.match(JAVASCRIPT_INJECTED_PATTERN)) {
    return false;
  } else {
    return true;
  }
}
