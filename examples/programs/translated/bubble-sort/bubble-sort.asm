; Bubble sort in x86-64 assembly (NASM): sort a list of numbers

default rel
extern printf
extern malloc
global main

section .data
integer_format: db "%lld", 0
text_format: db "%s", 0
newline_format: db 10, 0

section .text
main:
    %push main
    %define %$numbers qword [rbp - 8]
    %define %$count qword [rbp - 16]
    %define %$pass qword [rbp - 24]
    %define %$index qword [rbp - 32]
    %define %$swap qword [rbp - 40]
    %define %$position qword [rbp - 48]
    push rbp
    mov rbp, rsp
    sub rsp, 48
    push 7
    push 0
    pop rsi
    pop rdi
    call new_array
    push rax
    push qword [rsp]
    push 0
    push 5
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 1
    push 3
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 2
    push 8
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 3
    push 1
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 4
    push 9
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 5
    push 2
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push qword [rsp]
    push 6
    push 7
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    pop rax
    mov %$numbers, rax
    push %$numbers
    pop rax
    push qword [rax - 8]
    pop rax
    mov %$count, rax
    push 0
    pop rax
    mov %$pass, rax
.L1:
    push %$pass
    push %$count
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push 0
    pop rax
    mov %$index, rax
.L3:
    push %$index
    push %$count
    push 1
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    push %$pass
    pop rcx
    pop rax
    sub rax, rcx
    push rax
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L4
    push %$numbers
    push %$index
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    push %$numbers
    push %$index
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rcx
    pop rax
    cmp rax, rcx
    jle .L5
    push %$numbers
    push %$index
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rax
    mov %$swap, rax
    push %$numbers
    push %$index
    push %$numbers
    push %$index
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push %$numbers
    push %$index
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    push %$swap
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    jmp .L6
.L5:
.L6:
    push %$index
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$index, rax
    jmp .L3
.L4:
    push %$pass
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$pass, rax
    jmp .L1
.L2:
    push 0
    pop rax
    mov %$position, rax
.L7:
    push %$position
    push %$count
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L8
    push %$numbers
    push %$position
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    pop rdi
    call print_integer
    call print_newline
    push %$position
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$position, rax
    jmp .L7
.L8:
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
