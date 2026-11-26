; Mutual recursion in x86-64 assembly (NASM): the Hofstadter Female and Male sequences

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db ": ", 0
text_1: db " ", 0

section .text
female:
    %push female
    %define %$index qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$index, rdi
    push %$index
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L1
    push 1
    pop rax
    leave
    ret
    jmp .L2
.L1:
.L2:
    push %$index
    push %$index
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rdi
    call female
    push rax
    pop rdi
    call male
    push rax
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rax
    leave
    ret
    %pop

male:
    %push male
    %define %$index qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$index, rdi
    push %$index
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L1
    push 0
    pop rax
    leave
    ret
    jmp .L2
.L1:
.L2:
    push %$index
    push %$index
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rdi
    call male
    push rax
    pop rdi
    call female
    push rax
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rax
    leave
    ret
    %pop

main:
    %push main
    %define %$index qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 0
    pop rax
    mov %$index, rax
.L1:
    push %$index
    push 20
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$index
    pop rdi
    call print_integer
    lea rdi, [text_0]
    call print_text
    push %$index
    pop rdi
    call female
    push rax
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    push %$index
    pop rdi
    call male
    push rax
    pop rdi
    call print_integer
    call print_newline
    push %$index
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$index, rax
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
