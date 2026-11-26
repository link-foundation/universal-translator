# Leap year in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz " is a leap year"
text_1: .asciz " is not a leap year"

    .text
.type is_leap_year, @function
is_leap_year:
    .set is_leap_year.year, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, is_leap_year.year(%rbp)
    pushq is_leap_year.year(%rbp)
    pushq $4
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
    jne .Lis_leap_year_L4
    pushq is_leap_year.year(%rbp)
    pushq $100
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
    jne .Lis_leap_year_L3
.Lis_leap_year_L4:
    pushq is_leap_year.year(%rbp)
    pushq $400
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
    jne .Lis_leap_year_L1
.Lis_leap_year_L3:
    pushq $1
    jmp .Lis_leap_year_L2
.Lis_leap_year_L1:
    pushq $0
.Lis_leap_year_L2:
    popq %rax
    leave
    ret
.size is_leap_year, .-is_leap_year

.type main, @function
main:
    .set main.year, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $1896
    popq %rax
    movq %rax, main.year(%rbp)
.Lmain_L1:
    pushq main.year(%rbp)
    pushq $1913
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.year(%rbp)
    popq %rdi
    call is_leap_year
    pushq %rax
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    je .Lmain_L3
    pushq main.year(%rbp)
    popq %rdi
    call print_integer
    leaq text_0(%rip), %rdi
    call print_text
    call print_newline
    jmp .Lmain_L4
.Lmain_L3:
    pushq main.year(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    call print_newline
.Lmain_L4:
    pushq main.year(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.year(%rbp)
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
