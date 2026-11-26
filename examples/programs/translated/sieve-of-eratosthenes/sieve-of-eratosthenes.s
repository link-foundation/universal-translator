# Sieve of Eratosthenes in x86-64 assembly (GNU as, AT&T): the primes up to 100

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"

    .text
.type main, @function
main:
    .set main.limit, -8
    .set main.is_prime, -16
    .set main.number, -24
    .set main.multiple, -32
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    pushq $100
    popq %rax
    movq %rax, main.limit(%rbp)
    pushq main.limit(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    pushq $1
    popq %rsi
    popq %rdi
    call new_array
    pushq %rax
    popq %rax
    movq %rax, main.is_prime(%rbp)
    pushq main.is_prime(%rbp)
    pushq $0
    pushq $0
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq main.is_prime(%rbp)
    pushq $1
    pushq $0
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq $2
    popq %rax
    movq %rax, main.number(%rbp)
.Lmain_L1:
    pushq main.number(%rbp)
    pushq main.limit(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.is_prime(%rbp)
    pushq main.number(%rbp)
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    pushq $1
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lmain_L3
    pushq main.number(%rbp)
    popq %rdi
    call print_integer
    call print_newline
    pushq main.number(%rbp)
    pushq main.number(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.multiple(%rbp)
.Lmain_L5:
    pushq main.multiple(%rbp)
    pushq main.limit(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jg .Lmain_L6
    pushq main.is_prime(%rbp)
    pushq main.multiple(%rbp)
    pushq $0
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq main.multiple(%rbp)
    pushq main.number(%rbp)
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.multiple(%rbp)
    jmp .Lmain_L5
.Lmain_L6:
    jmp .Lmain_L4
.Lmain_L3:
.Lmain_L4:
    pushq main.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.number(%rbp)
    jmp .Lmain_L1
.Lmain_L2:
    xorl %eax, %eax
    leave
    ret
.size main, .-main

new_array:
    pushq %rbp
    movq %rsp, %rbp
    andq $-16, %rsp
    pushq %rdi
    pushq %rsi
    leaq 8(,%rdi,8), %rdi
    call malloc@PLT
    popq %rsi
    popq %rdi
    movq %rdi, (%rax)
    addq $8, %rax
    xorl %ecx, %ecx
.Lnew_array_fill:
    cmpq %rdi, %rcx
    jge .Lnew_array_done
    movq %rsi, (%rax,%rcx,8)
    incq %rcx
    jmp .Lnew_array_fill
.Lnew_array_done:
    leave
    ret

print_integer:
    pushq %rbp
    movq %rsp, %rbp
    andq $-16, %rsp
    movq %rdi, %rsi
    leaq integer_format(%rip), %rdi
    xorl %eax, %eax
    call printf@PLT
    leave
    ret

print_text:
    pushq %rbp
    movq %rsp, %rbp
    andq $-16, %rsp
    movq %rdi, %rsi
    leaq text_format(%rip), %rdi
    xorl %eax, %eax
    call printf@PLT
    leave
    ret

print_newline:
    pushq %rbp
    movq %rsp, %rbp
    andq $-16, %rsp
    leaq newline_format(%rip), %rdi
    xorl %eax, %eax
    call printf@PLT
    leave
    ret

    .section .note.GNU-stack,"",@progbits
