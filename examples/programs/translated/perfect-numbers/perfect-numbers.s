# Perfect numbers in x86-64 assembly (GNU as, AT&T): numbers equal to the sum of their divisors

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"

    .text
.type is_perfect, @function
is_perfect:
    .set is_perfect.number, -8
    .set is_perfect.sum, -16
    .set is_perfect.divisor, -24
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    movq %rdi, is_perfect.number(%rbp)
    pushq $1
    popq %rax
    movq %rax, is_perfect.sum(%rbp)
    pushq $2
    popq %rax
    movq %rax, is_perfect.divisor(%rbp)
.Lis_perfect_L1:
    pushq is_perfect.divisor(%rbp)
    pushq is_perfect.divisor(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    pushq is_perfect.number(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jg .Lis_perfect_L2
    pushq is_perfect.number(%rbp)
    pushq is_perfect.divisor(%rbp)
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
    jne .Lis_perfect_L3
    pushq is_perfect.sum(%rbp)
    pushq is_perfect.divisor(%rbp)
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, is_perfect.sum(%rbp)
    pushq is_perfect.divisor(%rbp)
    pushq is_perfect.divisor(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    pushq is_perfect.number(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    je .Lis_perfect_L5
    pushq is_perfect.sum(%rbp)
    pushq is_perfect.number(%rbp)
    pushq is_perfect.divisor(%rbp)
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    pushq %rax
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, is_perfect.sum(%rbp)
    jmp .Lis_perfect_L6
.Lis_perfect_L5:
.Lis_perfect_L6:
    jmp .Lis_perfect_L4
.Lis_perfect_L3:
.Lis_perfect_L4:
    pushq is_perfect.divisor(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, is_perfect.divisor(%rbp)
    jmp .Lis_perfect_L1
.Lis_perfect_L2:
    pushq is_perfect.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jle .Lis_perfect_L7
    pushq is_perfect.sum(%rbp)
    pushq is_perfect.number(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lis_perfect_L7
    pushq $1
    jmp .Lis_perfect_L8
.Lis_perfect_L7:
    pushq $0
.Lis_perfect_L8:
    popq %rax
    leave
    ret
.size is_perfect, .-is_perfect

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
    pushq $10001
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.number(%rbp)
    popq %rdi
    call is_perfect
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
