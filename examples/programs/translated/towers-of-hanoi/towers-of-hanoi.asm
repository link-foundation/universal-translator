; Towers of Hanoi in x86-64 assembly, solved recursively

default rel
extern printf
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "Move disk ", 0
text_1: db " from ", 0
text_2: db " to ", 0

section .text
move_disks:
    %push move_disks
    %define %$count qword [rbp - 8]
    %define %$source qword [rbp - 16]
    %define %$target qword [rbp - 24]
    %define %$spare qword [rbp - 32]
    push rbp
    mov rbp, rsp
    sub rsp, 32
    mov %$count, rdi
    mov %$source, rsi
    mov %$target, rdx
    mov %$spare, rcx
    push %$count
    push 0
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L1
    leave
    ret
    jmp .L2
.L1:
.L2:
    push %$count
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    push %$source
    push %$spare
    push %$target
    pop rcx
    pop rdx
    pop rsi
    pop rdi
    call move_disks
    lea rdi, [text_0]
    call print_text
    push %$count
    pop rdi
    call print_integer
    lea rdi, [text_1]
    call print_text
    push %$source
    pop rdi
    call print_integer
    lea rdi, [text_2]
    call print_text
    push %$target
    pop rdi
    call print_integer
    call print_newline
    push %$count
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    push %$spare
    push %$target
    push %$source
    pop rcx
    pop rdx
    pop rsi
    pop rdi
    call move_disks
    leave
    ret
    %pop

main:
    %push main
    push rbp
    mov rbp, rsp
    push 4
    push 1
    push 3
    push 2
    pop rcx
    pop rdx
    pop rsi
    pop rdi
    call move_disks
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
