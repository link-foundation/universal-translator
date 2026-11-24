; Leap year in x86-64 assembly

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db " is a leap year", 0
text_1: db " is not a leap year", 0

section .text
is_leap_year:
    %push is_leap_year
    %define %$year qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$year, rdi
    push %$year
    push 4
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
    jne .L4
    push %$year
    push 100
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
.L4:
    push %$year
    push 400
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
    jne .L1
.L3:
    push 1
    jmp .L2
.L1:
    push 0
.L2:
    pop rax
    leave
    ret
    %pop

main:
    %push main
    %define %$year qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 1896
    pop rax
    mov %$year, rax
.L1:
    push %$year
    push 1913
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$year
    pop rdi
    call is_leap_year
    push rax
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    je .L3
    push %$year
    pop rdi
    call print_integer
    lea rdi, [text_0]
    call print_text
    call print_newline
    jmp .L4
.L3:
    push %$year
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    call print_newline
.L4:
    push %$year
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$year, rax
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
