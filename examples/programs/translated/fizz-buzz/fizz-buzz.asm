; FizzBuzz in x86-64 assembly (NASM)

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "FizzBuzz", 0
text_1: db "Fizz", 0
text_2: db "Buzz", 0

section .text
main:
    %push main
    %define %$number qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 1
    pop rax
    mov %$number, rax
.L1:
    push %$number
    push 101
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$number
    push 15
    pop rcx
    pop rax
    cqo
    idiv rcx
    mov rax, rdx
    push rax
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L3
    lea rdi, [text_0]
    call print_text
    call print_newline
    jmp .L4
.L3:
    push %$number
    push 3
    pop rcx
    pop rax
    cqo
    idiv rcx
    mov rax, rdx
    push rax
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L5
    lea rdi, [text_1]
    call print_text
    call print_newline
    jmp .L6
.L5:
    push %$number
    push 5
    pop rcx
    pop rax
    cqo
    idiv rcx
    mov rax, rdx
    push rax
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L7
    lea rdi, [text_2]
    call print_text
    call print_newline
    jmp .L8
.L7:
    push %$number
    pop rdi
    call print_integer
    call print_newline
.L8:
.L6:
.L4:
    push %$number
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$number, rax
    jmp .L1
.L2:
    xor eax, eax
    leave
    ret
    %pop

print_integer:
    push rbp
    mov rbp, rsp
    and rsp, -16
    mov rsi, rdi
    lea rdi, [integer_format]
    xor eax, eax
    call printf wrt ..plt
    leave
    ret

print_text:
    push rbp
    mov rbp, rsp
    and rsp, -16
    mov rsi, rdi
    lea rdi, [text_format]
    xor eax, eax
    call printf wrt ..plt
    leave
    ret

print_newline:
    push rbp
    mov rbp, rsp
    and rsp, -16
    lea rdi, [newline_format]
    xor eax, eax
    call printf wrt ..plt
    leave
    ret

section .note.GNU-stack noalloc noexec nowrite progbits
