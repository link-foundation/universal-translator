// Finite lexical probe; ask PHP which opening-tag suffixes are recognized.
import { execFileSync } from 'node:child_process';
const suffixes = [' ', '\t', '\r', '\n', '\f', '\v', '\u00a0', ''];
const sources = suffixes.map((suffix) => `<?php${suffix}echo "ok";`);
const probe =
  '$taskSources=json_decode($argv[1],true);foreach($taskSources as $taskSource){$taskTokens=token_get_all($taskSource);echo json_encode(["source"=>$taskSource,"open"=>is_array($taskTokens[0])&&$taskTokens[0][0]===T_OPEN_TAG]),"\\n";}';
console.log(
  execFileSync(
    'php',
    ['-d', 'memory_limit=32M', '-r', probe, JSON.stringify(sources)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 }
  )
);
