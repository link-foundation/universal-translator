; Greatest element of a list in x86-64 assembly

default rel
extern printf
extern malloc
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0
text_0: db "The greatest element is ", 0

section .text
main:
    %push main
    %define %$numbers qword [rbp - 8]
    %define %$greatest qword [rbp - 16]
    %define %$index qword [rbp - 24]
    %define %$number qword [rbp - 32]
    push rbp
    mov rbp, rsp
    sub rsp, 32
    push 7
    push 0
    pop rsi
    pop rdi
    call new_array
    push rax
    push qword [rsp]
    push 0
    push 17
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 1
    push 4
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 2
    push 93
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 3
    push 28
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 4
    push 65
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 5
    push 3
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 6
    push 80
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    pop rax
    mov %$numbers, rax
    push %$numbers
    push 0
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rax
    mov %$greatest, rax
    push 0
    pop rax
    mov %$index, rax
.L1:
    push %$index
    push %$numbers
    pop rax
    push qword [rax - 8]
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$numbers
    push %$index
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rax
    mov %$number, rax
    push %$number
    push %$greatest
    pop rcx
    pop rax
    cmp rax, rcx
    jle .L3
    push %$number
    pop rax
    mov %$greatest, rax
    jmp .L4
.L3:
.L4:
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
    lea rdi, [text_0]
    call print_text
    push %$greatest
    pop rdi
    call print_integer
    call print_newline
    xor eax, eax
    leave
    ret
    %pop

new_array:
    push rbp
    mov rbp, rsp
    and rsp, -16
    push rdi
    push rsi
    lea rdi, [rdi * 8 + 8]
    call malloc wrt ..plt
    pop rsi
    pop rdi
    mov [rax], rdi
    add rax, 8
    xor ecx, ecx
.fill:
    cmp rcx, rdi
    jge .done
    mov [rax + rcx * 8], rsi
    inc rcx
    jmp .fill
.done:
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
