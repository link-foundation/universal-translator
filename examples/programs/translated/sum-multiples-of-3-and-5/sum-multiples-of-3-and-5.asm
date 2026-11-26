; Sum multiples of 3 and 5 in x86-64 assembly (NASM): the sum of the multiples below 1000

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0

section .text
main:
    %push main
    %define %$total qword [rbp - 8]
    %define %$number qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 0
    pop rax
    mov %$total, rax
    push 1
    pop rax
    mov %$number, rax
.L1:
    push %$number
    push 1000
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
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
    je .L5
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
    jne .L3
.L5:
    push %$total
    push %$number
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$total, rax
    jmp .L4
.L3:
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
    push %$total
    pop rdi
    call print_integer
    call print_newline
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
