# Sum digits of an integer in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "The digits of 1234567890 sum to "

    .text
.type sum_of_digits, @function
sum_of_digits:
    .set sum_of_digits.number, -8
    .set sum_of_digits.total, -16
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, sum_of_digits.number(%rbp)
    pushq $0
    popq %rax
    movq %rax, sum_of_digits.total(%rbp)
.Lsum_of_digits_L1:
    pushq sum_of_digits.number(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jle .Lsum_of_digits_L2
    pushq sum_of_digits.total(%rbp)
    pushq sum_of_digits.number(%rbp)
    pushq $10
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    movq %rdx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, sum_of_digits.total(%rbp)
    pushq sum_of_digits.number(%rbp)
    pushq $10
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    pushq %rax
    popq %rax
    movq %rax, sum_of_digits.number(%rbp)
    jmp .Lsum_of_digits_L1
.Lsum_of_digits_L2:
    pushq sum_of_digits.total(%rbp)
    popq %rax
    leave
    ret
.size sum_of_digits, .-sum_of_digits

.type main, @function
main:
    pushq %rbp
    movq %rsp, %rbp
    leaq text_0(%rip), %rdi
    call print_text
    pushq $1234567890
    popq %rdi
    call sum_of_digits
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
