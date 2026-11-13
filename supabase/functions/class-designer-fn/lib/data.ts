// 번들에 넣는 기본 데이터 (원본 PHP 앱 src/data 의 JSON 그대로). 관리자가 고친 값은 DB(kb_overrides)에서 덮어씀
import coreSeed from './data/core_seed.json' with { type: 'json' };
import knowledge from './data/bmr_knowledge.json' with { type: 'json' };
// deno-lint-ignore no-explicit-any
export const FILES: Record<string, any> = { 'core_seed.json': coreSeed, 'bmr_knowledge.json': knowledge };
