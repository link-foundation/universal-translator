; Ackermann procedure in x86-64 assembly, defined recursively

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "ackermann(", 0
text_1: db ", ", 0
text_2: db ") = ", 0

section .text
ackermann:
    %push ackermann
    %define %$first qword [rbp - 8]
    %define %$second qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$first, rdi
    mov %$second, rsi
    push %$first
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L1
    push %$second
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    leave
    ret
    jmp .L2
.L1:
.L2:
    push %$second
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L3
    push %$first
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    push 1
    pop rsi
    pop rdi
    call ackermann
    push rax
    pop rax
    leave
    ret
    jmp .L4
.L3:
.L4:
    push %$first
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    push %$first
    push %$second
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rsi
    pop rdi
    call ackermann
    push rax
    pop rsi
    pop rdi
    call ackermann
    push rax
    pop rax
    leave
    ret
    %pop

main:
    %push main
    %define %$first qword [rbp - 8]
    %define %$second qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 0
    pop rax
    mov %$first, rax
.L1:
    push %$first
    push 4
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push 0
    pop rax
    mov %$second, rax
.L3:
    push %$second
    push 5
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L4
    lea rdi, [text_0]
    call print_text
    push %$first
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    push %$second
    pop rdi
    call print_integer
    lea rdi, [text_2]
    call print_text
    push %$first
    push %$second
    pop rsi
    pop rdi
    call ackermann
    push rax
    pop rdi
    call print_integer
    call print_newline
    push %$second
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$second, rax
    jmp .L3
.L4:
    push %$first
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$first, rax
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
