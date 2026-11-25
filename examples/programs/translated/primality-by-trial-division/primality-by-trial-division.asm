; Primality by trial division in x86-64 assembly

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0

section .text
is_prime:
    %push is_prime
    %define %$number qword [rbp - 8]
    %define %$divisor qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$number, rdi
    push %$number
    push 2
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L1
    push 0
    pop rax
    leave
    ret
    jmp .L2
.L1:
.L2:
    push 2
    pop rax
    mov %$divisor, rax
.L3:
    push %$divisor
    push %$divisor
    pop rcx
    pop rax
    imul rax, rcx
    push rax
    push %$number
    pop rcx
    pop rax
    cmp rax, rcx
    jg .L4
    push %$number
    push %$divisor
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
    push 0
    pop rax
    leave
    ret
    jmp .L6
.L5:
.L6:
    push %$divisor
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$divisor, rax
    jmp .L3
.L4:
    push 1
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
    push 51
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$number
    pop rdi
    call is_prime
    push rax
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    je .L3
    push %$number
    pop rdi
    call print_integer
    call print_newline
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
