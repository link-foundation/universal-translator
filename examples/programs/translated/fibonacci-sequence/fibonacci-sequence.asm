; Fibonacci sequence in x86-64 assembly (NASM), computed iteratively

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "fibonacci(", 0
text_1: db ") = ", 0

section .text
fibonacci:
    %push fibonacci
    %define %$count qword [rbp - 8]
    %define %$previous qword [rbp - 16]
    %define %$current qword [rbp - 24]
    %define %$step qword [rbp - 32]
    %define %$next qword [rbp - 40]
    push rbp
    mov rbp, rsp
    sub rsp, 48
    mov %$count, rdi
    push 0
    pop rax
    mov %$previous, rax
    push 1
    pop rax
    mov %$current, rax
    push 0
    pop rax
    mov %$step, rax
.L1:
    push %$step
    push %$count
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$previous
    push %$current
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$next, rax
    push %$current
    pop rax
    mov %$previous, rax
    push %$next
    pop rax
    mov %$current, rax
    push %$step
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$step, rax
    jmp .L1
.L2:
    push %$previous
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
    push 21
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    lea rdi, [text_0]
    call print_text
    push %$index
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    push %$index
    pop rdi
    call fibonacci
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
