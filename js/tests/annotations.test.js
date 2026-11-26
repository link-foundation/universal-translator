import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';
import { createTranslator } from '../src/index.js';

const translator = createTranslator();
const source = readFileSync(
  new URL(
    '../../examples/translation/spring/create-user.java',
    import.meta.url
  ),
  'utf8'
);

describe('declaration annotations and named types', () => {
  it('keeps Spring annotations separate from names and types', () => {
    const [method] = translator.toMeta(source, 'java').functions;
    expect(method.name).toBe('create-user');
    expect(method.returnType).toBe('source:ResponseEntity < UserDto >');
    expect(method.annotations[0].expression.name).toBe('PostMapping');
    expect(method.parameters[0].name).toBe('request');
    expect(method.parameters[0].type).toBe('source:CreateUserRequest');
    expect(
      method.parameters[0].annotations.map((value) => value.expression.name)
    ).toEqual(['RequestBody', 'Valid']);
    expect(method.body.statements[0].type).toBe('source:UserDto');
  });

  it('writes annotations and fluent calls to Python and reads them back', () => {
    const python = translator.translate(source, 'java', 'python');
    expect(python).toContain('from typing import Annotated');
    expect(python).toContain('@PostMapping');
    expect(python).toContain(
      'request: "Annotated[CreateUserRequest, RequestBody, Valid]"'
    );
    expect(python).toContain('-> "ResponseEntity[UserDto]"');
    expect(python).toContain(
      'ResponseEntity.status(HttpStatus.CREATED).body(user)'
    );
    const java = translator.translate(python, 'python', 'java');
    expect(java).toContain('@PostMapping');
    expect(java).toContain('@RequestBody @Valid CreateUserRequest request');
    expect(java).toContain('ResponseEntity<UserDto> createUser');
    const kotlin = translator.translate(source, 'java', 'kotlin');
    expect(translator.translate(kotlin, 'kotlin', 'java')).toContain(
      '@RequestBody @Valid CreateUserRequest request'
    );
  });

  it('balances nested generic commas and empty multiline parameter lists', () => {
    const source =
      'Map<String, List<UserDto>> lookup(Map<String, List<UserDto>> users, int count) { return users; }';
    const [method] = translator.toMeta(source, 'java').functions;
    expect(method.parameters.map((parameter) => parameter.name)).toEqual([
      'users',
      'count',
    ]);
    expect(translator.translate(source, 'java', 'python')).toContain(
      'Map[String,List[UserDto]]'
    );
    expect(
      translator.toMeta('UserDto lookup(\n) { return user; }', 'java')
        .functions[0].parameters
    ).toEqual([]);
  });

  it('preserves annotation arguments as expressions', () => {
    const python = translator.translate(
      '@PostMapping("/users")\nUserDto create(@Valid UserDto user) { return user; }',
      'java',
      'python'
    );
    expect(python).toContain('@PostMapping("/users")');
  });

  it('requires an explicit mapping for targets without annotation syntax', () => {
    expect(() => translator.translate(source, 'java', 'c')).toThrow(
      'Annotations need a framework mapping'
    );
  });
});
