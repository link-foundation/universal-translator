// Generated from data/04-machine.lino.
export default `profile:
  id: nasm-x86-64
  kind: instruction
  label: 'NASM x86-64 (Linux)'
  comment: ;
  call: 'function call'
  output: 'write syscall'
  forms:
    form:
      task: hello
      name: standard
      fixed:
        message: 'Hello, World!'
      requires: 'Linux x86-64 syscall ABI'
      source: '''global _start

section .rodata
    message db "Hello, World!", 10
    message_length equ $ - message

section .text
_start:
    mov eax, 1
    mov edi, 1
    lea rsi, [rel message]
    mov edx, message_length
    syscall

    mov eax, 60
    xor edi, edi
    syscall'''
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Linux x86-64 syscall ABI'
      source: '''global _start

section .bss
    output resb 11

section .text
_start:
    mov eax, {{left}}
    mov ecx, {{right}}
.euclid:
    test ecx, ecx
    jz .format_decimal
    xor edx, edx
    div ecx
    mov eax, ecx
    mov ecx, edx
    jmp .euclid

.format_decimal:
    lea rsi, [rel output + 10]
    mov byte [rsi], 10
    mov ecx, 10
.next_digit:
    xor edx, edx
    div ecx
    add dl, '0'
    dec rsi
    mov [rsi], dl
    test eax, eax
    jnz .next_digit
    lea rdx, [rel output + 11]
    sub rdx, rsi
    mov eax, 1
    mov edi, 1
    syscall

    mov eax, 60
    xor edi, edi
    syscall'''
    form:
      task: fizz-buzz
      name: standard
      requires: 'Linux x86-64 syscall ABI'
      source: '''global _start

section .rodata
    fizz db "Fizz", 10
    fizz_length equ $ - fizz
    buzz db "Buzz", 10
    buzz_length equ $ - buzz
    fizz_buzz db "FizzBuzz", 10
    fizz_buzz_length equ $ - fizz_buzz

section .bss
    output resb 11

section .text
_start:
    mov r12d, 1
.next_number:
    cmp r12d, {{limit}}
    ja .finish

    mov eax, r12d
    mov ecx, 15
    xor edx, edx
    div ecx
    test edx, edx
    jz .print_fizz_buzz

    mov eax, r12d
    mov ecx, 3
    xor edx, edx
    div ecx
    test edx, edx
    jz .print_fizz

    mov eax, r12d
    mov ecx, 5
    xor edx, edx
    div ecx
    test edx, edx
    jz .print_buzz

    mov eax, r12d
    lea rsi, [rel output + 10]
    mov byte [rsi], 10
    mov ecx, 10
.next_digit:
    xor edx, edx
    div ecx
    add dl, '0'
    dec rsi
    mov [rsi], dl
    test eax, eax
    jnz .next_digit
    lea rdx, [rel output + 11]
    sub rdx, rsi
    jmp .write_line

.print_fizz_buzz:
    lea rsi, [rel fizz_buzz]
    mov edx, fizz_buzz_length
    jmp .write_line
.print_fizz:
    lea rsi, [rel fizz]
    mov edx, fizz_length
    jmp .write_line
.print_buzz:
    lea rsi, [rel buzz]
    mov edx, buzz_length
.write_line:
    mov eax, 1
    mov edi, 1
    syscall
    inc r12d
    jmp .next_number

.finish:
    mov eax, 60
    xor edi, edi
    syscall'''

profile:
  id: gas-aarch64
  kind: instruction
  label: 'GNU AArch64 assembly (Linux)'
  comment: //
  call: 'function call'
  output: 'write syscall'
  forms:
    form:
      task: hello
      name: standard
      fixed:
        message: 'Hello, World!'
      requires: 'Linux AArch64 syscall ABI'
      source: '''.global _start

.section .rodata
message:
    .ascii "Hello, World!\\n"
.equ message_length, . - message

.text
_start:
    mov x0, #1
    adr x1, message
    mov x2, #message_length
    mov x8, #64
    svc #0

    mov x0, #0
    mov x8, #93
    svc #0'''

profile:
  id: llvm-ir
  kind: instruction
  label: 'LLVM IR'
  comment: ;
  call: 'function call'
  output: puts
  forms:
    form:
      task: hello
      name: standard
      fixed:
        message: 'Hello, World!'
      requires: 'libc puts'
      source: '''@message = private constant [14 x i8] c"Hello, World!\\00"

declare i32 @puts(ptr)

define i32 @main() {
  call i32 @puts(ptr @message)
  ret i32 0
}'''

profile:
  id: cil
  kind: instruction
  label: '.NET CIL (ILAsm)'
  comment: //
  call: 'method call'
  output: 'System.Console::WriteLine'
  forms:
    form:
      task: hello
      name: standard
      fixed:
        message: 'Hello, World!'
      requires: mscorlib HelloWorld
      source: '''.assembly extern mscorlib {}
.assembly HelloWorld {}
.module HelloWorld.exe

.class private auto ansi HelloWorld extends [mscorlib]System.Object
{
    .method public hidebysig static void Main() cil managed
    {
        .entrypoint
        .maxstack 1
        ldstr "Hello, World!"
        call void [mscorlib]System.Console::WriteLine(string)
        ret
    }
}'''

profile:
  id: jvm-jasmin
  kind: instruction
  label: 'JVM bytecode (Jasmin)'
  comment: ;
  call: 'method call'
  output: java/io/PrintStream/println
  forms:
    form:
      task: hello
      name: standard
      fixed:
        message: 'Hello, World!'
      requires: Main java/lang/System/out
      source: '''.class public Main
.super java/lang/Object

.method public static main([Ljava/lang/String;)V
    .limit stack 2
    .limit locals 1
    getstatic java/lang/System/out Ljava/io/PrintStream;
    ldc "Hello, World!"
    invokevirtual java/io/PrintStream/println(Ljava/lang/String;)V
    return
.end method'''
`;
