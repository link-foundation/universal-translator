; Sum digits of an integer in x86-64 assembly

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "The digits of 1234567890 sum to ", 0

section .text
sum_of_digits:
    %push sum_of_digits
    %define %$number qword [rbp - 8]
    %define %$total qword [rbp - 16]
    push rbp
    mov rbp, rsp
    sub rsp, 16
    mov %$number, rdi
    push 0
    pop rax
    mov %$total, rax
.L1:
    push %$number
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jle .L2
    push %$total
    push %$number
    push 10
    pop rcx
    pop rax
    cqo
    idiv rcx
    mov rax, rdx
    push rax
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$total, rax
    push %$number
    push 10
    pop rcx
    pop rax
    cqo
    idiv rcx
    push rax
    pop rax
    mov %$number, rax
    jmp .L1
.L2:
    push %$total
    pop rax
    leave
    ret
    %pop

main:
    %push main
    push rbp
    mov rbp, rsp
    lea rdi, [text_0]
    call print_text
    push 1234567890
    pop rdi
    call sum_of_digits
    push rax
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
