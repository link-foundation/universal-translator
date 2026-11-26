# Sum of squares in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "Sum of squares from 1 to "
text_1: .asciz ":"

    .text
.type sum_of_squares, @function
sum_of_squares:
    .set sum_of_squares.limit, -8
    .set sum_of_squares.total, -16
    .set sum_of_squares.number, -24
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    movq %rdi, sum_of_squares.limit(%rbp)
    pushq $0
    popq %rax
    movq %rax, sum_of_squares.total(%rbp)
    pushq $1
    popq %rax
    movq %rax, sum_of_squares.number(%rbp)
.Lsum_of_squares_L1:
    pushq sum_of_squares.number(%rbp)
    pushq sum_of_squares.limit(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jg .Lsum_of_squares_L2
    pushq sum_of_squares.total(%rbp)
    pushq sum_of_squares.number(%rbp)
    pushq sum_of_squares.number(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, sum_of_squares.total(%rbp)
    pushq sum_of_squares.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, sum_of_squares.number(%rbp)
    jmp .Lsum_of_squares_L1
.Lsum_of_squares_L2:
    pushq sum_of_squares.total(%rbp)
    popq %rax
    leave
    ret
.size sum_of_squares, .-sum_of_squares

.type main, @function
main:
    .set main.limit, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $10
    popq %rax
    movq %rax, main.limit(%rbp)
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.limit(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    call print_newline
    pushq main.limit(%rbp)
    popq %rdi
    call sum_of_squares
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
