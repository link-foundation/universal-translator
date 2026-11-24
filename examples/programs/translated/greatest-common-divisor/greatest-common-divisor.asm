; Greatest common divisor in x86-64 assembly, using the Euclidean algorithm

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "The greatest common divisor of 1071 and 462 is ", 0

section .text
greatest_common_divisor:
    push rbp
    mov rbp, rsp
    sub rsp, 32
    mov qword [rbp - 8], rdi
    mov qword [rbp - 16], rsi
.L1:
    push qword [rbp - 16]
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    je .L2
    push qword [rbp - 8]
    push qword [rbp - 16]
    pop rcx
    pop rax
    cqo
    idiv rcx
    mov rax, rdx
    push rax
    pop rax
    mov qword [rbp - 24], rax
    push qword [rbp - 16]
    pop rax
    mov qword [rbp - 8], rax
    push qword [rbp - 24]
    pop rax
    mov qword [rbp - 16], rax
    jmp .L1
.L2:
    push qword [rbp - 8]
    pop rax
    leave
    ret

main:
    push rbp
    mov rbp, rsp
    lea rdi, [text_0]
    call print_text
    push 1071
    push 462
    pop rsi
    pop rdi
    call greatest_common_divisor
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
