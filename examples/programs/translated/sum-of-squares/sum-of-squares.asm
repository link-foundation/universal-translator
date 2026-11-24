; Sum of squares in x86-64 assembly

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "Sum of squares from 1 to ", 0
text_1: db ":", 0

section .text
sum_of_squares:
    push rbp
    mov rbp, rsp
    sub rsp, 32
    mov qword [rbp - 8], rdi
    push 0
    pop rax
    mov qword [rbp - 16], rax
    push 1
    pop rax
    mov qword [rbp - 24], rax
.L1:
    push qword [rbp - 24]
    push qword [rbp - 8]
    pop rcx
    pop rax
    cmp rax, rcx
    jg .L2
    push qword [rbp - 16]
    push qword [rbp - 24]
    push qword [rbp - 24]
    pop rcx
    pop rax
    imul rax, rcx
    push rax
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov qword [rbp - 16], rax
    push qword [rbp - 24]
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov qword [rbp - 24], rax
    jmp .L1
.L2:
    push qword [rbp - 16]
    pop rax
    leave
    ret

main:
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 10
    pop rax
    mov qword [rbp - 8], rax
    lea rdi, [text_0]
    call print_text
    push qword [rbp - 8]
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    call print_newline
    push qword [rbp - 8]
    pop rdi
    call sum_of_squares
    push rax
    pop rdi
    call print_integer
    call print_newline
    xor eax, eax
    leave
    ret

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
