# Greatest common divisor in x86-64 assembly (GNU as, AT&T), using the Euclidean algorithm

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "The greatest common divisor of 1071 and 462 is "

    .text
.type greatest_common_divisor, @function
greatest_common_divisor:
    .set greatest_common_divisor.first, -8
    .set greatest_common_divisor.second, -16
    .set greatest_common_divisor.remainder, -24
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    movq %rdi, greatest_common_divisor.first(%rbp)
    movq %rsi, greatest_common_divisor.second(%rbp)
.Lgreatest_common_divisor_L1:
    pushq greatest_common_divisor.second(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    je .Lgreatest_common_divisor_L2
    pushq greatest_common_divisor.first(%rbp)
    pushq greatest_common_divisor.second(%rbp)
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    movq %rdx, %rax
    pushq %rax
    popq %rax
    movq %rax, greatest_common_divisor.remainder(%rbp)
    pushq greatest_common_divisor.second(%rbp)
    popq %rax
    movq %rax, greatest_common_divisor.first(%rbp)
    pushq greatest_common_divisor.remainder(%rbp)
    popq %rax
    movq %rax, greatest_common_divisor.second(%rbp)
    jmp .Lgreatest_common_divisor_L1
.Lgreatest_common_divisor_L2:
    pushq greatest_common_divisor.first(%rbp)
    popq %rax
    leave
    ret
.size greatest_common_divisor, .-greatest_common_divisor

.type main, @function
main:
    pushq %rbp
    movq %rsp, %rbp
    leaq text_0(%rip), %rdi
    call print_text
    pushq $1071
    pushq $462
    popq %rsi
    popq %rdi
    call greatest_common_divisor
    pushq %rax
    popq %rdi
    call print_integer
    call print_newline
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
