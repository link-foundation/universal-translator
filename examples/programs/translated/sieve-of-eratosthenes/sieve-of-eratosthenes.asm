; Sieve of Eratosthenes in x86-64 assembly: the primes up to 100

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
    %define %$limit qword [rbp - 8]
    %define %$is_prime qword [rbp - 16]
    %define %$number qword [rbp - 24]
    %define %$multiple qword [rbp - 32]
    push rbp
    mov rbp, rsp
    sub rsp, 32
    push 100
    pop rax
    mov %$limit, rax
    push %$limit
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    push 1
    pop rsi
    pop rdi
    call new_array
    push rax
    pop rax
    mov %$is_prime, rax
    push %$is_prime
    push 0
    push 0
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push %$is_prime
    push 1
    push 0
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push 2
    pop rax
    mov %$number, rax
.L1:
    push %$number
    push %$limit
    push 1
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rcx
    pop rax
    cmp rax, rcx
    jge .L2
    push %$is_prime
    push %$number
    pop rcx
    pop rax
    push qword [rax + rcx * 8]
    push 1
    pop rcx
    pop rax
    cmp rax, rcx
    jne .L3
    push %$number
    pop rdi
    call print_integer
    call print_newline
    push %$number
    push %$number
    pop rcx
    pop rax
    imul rax, rcx
    push rax
    pop rax
    mov %$multiple, rax
.L5:
    push %$multiple
    push %$limit
    pop rcx
    pop rax
    cmp rax, rcx
    jg .L6
    push %$is_prime
    push %$multiple
    push 0
    pop rdx
    pop rcx
    pop rax
    mov [rax + rcx * 8], rdx
    push %$multiple
    push %$number
    pop rcx
    pop rax
    add rax, rcx
    push rax
    pop rax
    mov %$multiple, rax
    jmp .L5
.L6:
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
