# Primality by trial division in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"

    .text
.type is_prime, @function
is_prime:
    .set is_prime.number, -8
    .set is_prime.divisor, -16
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, is_prime.number(%rbp)
    pushq is_prime.number(%rbp)
    pushq $2
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lis_prime_L1
    pushq $0
    popq %rax
    leave
    ret
    jmp .Lis_prime_L2
.Lis_prime_L1:
.Lis_prime_L2:
    pushq $2
    popq %rax
    movq %rax, is_prime.divisor(%rbp)
.Lis_prime_L3:
    pushq is_prime.divisor(%rbp)
    pushq is_prime.divisor(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    pushq is_prime.number(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jg .Lis_prime_L4
    pushq is_prime.number(%rbp)
    pushq is_prime.divisor(%rbp)
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    movq %rdx, %rax
    pushq %rax
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lis_prime_L5
    pushq $0
    popq %rax
    leave
    ret
    jmp .Lis_prime_L6
.Lis_prime_L5:
.Lis_prime_L6:
    pushq is_prime.divisor(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, is_prime.divisor(%rbp)
    jmp .Lis_prime_L3
.Lis_prime_L4:
    pushq $1
    popq %rax
    leave
    ret
.size is_prime, .-is_prime

.type main, @function
main:
    .set main.number, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $1
    popq %rax
    movq %rax, main.number(%rbp)
.Lmain_L1:
    pushq main.number(%rbp)
    pushq $51
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.number(%rbp)
    popq %rdi
    call is_prime
    pushq %rax
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    je .Lmain_L3
    pushq main.number(%rbp)
    popq %rdi
    call print_integer
    call print_newline
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
