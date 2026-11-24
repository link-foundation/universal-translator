; 99 bottles of beer in x86-64 assembly

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db " bottles of beer on the wall, ", 0
text_1: db " bottles of beer.", 0
text_2: db "Take one down and pass it around, ", 0
text_3: db " bottles of beer on the wall.", 0

section .text
main:
    %push main
    %define %$bottles qword [rbp - 8]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    push 99
    pop rax
    mov %$bottles, rax
.L1:
    push %$bottles
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jle .L2
    push %$bottles
    pop rdi
    call print_integer
    lea rdi, [text_0]
    call print_text
    push %$bottles
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    call print_newline
    lea rdi, [text_2]
    call print_text
    push %$bottles
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rdi
    call print_integer
    lea rdi, [text_3]
    call print_text
    call print_newline
    push %$bottles
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rax
    mov %$bottles, rax
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
