; Hailstone sequence in x86-64 assembly (NASM): count the steps to reach 1

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db " takes ", 0
text_1: db " steps", 0

section .text
hailstone_steps:
    %push hailstone_steps
    %define %$number qword [rbp - 8]
    %define %$steps qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$number, rdi
    push 0
    pop rax
    mov %$steps, rax
.L1:
    push %$number
    push 1
    pop rcx
    pop rax
    cmp rax, rcx
    je .L2
    push %$number
    push 2
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
    push %$number
    push 2
    pop rcx
    pop rax
    cqo
    idiv rcx
    push rax
    pop rax
    mov %$number, rax
    jmp .L4
.L3:
    push 3
    push %$number
    pop rcx
    pop rax
    imul rax, rcx
    push rax
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$number, rax
.L4:
    push %$steps
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$steps, rax
    jmp .L1
.L2:
    push %$steps
    pop rax
    leave
    ret
    %pop

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
    push 11
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$number
    pop rdi
    call print_integer
    lea rdi, [text_0]
    call print_text
    push %$number
    pop rdi
    call hailstone_steps
    push rax
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    call print_newline
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
