# 99 bottles of beer in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz " bottles of beer on the wall, "
text_1: .asciz " bottles of beer."
text_2: .asciz "Take one down and pass it around, "
text_3: .asciz " bottles of beer on the wall."

    .text
.type main, @function
main:
    .set main.bottles, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $99
    popq %rax
    movq %rax, main.bottles(%rbp)
.Lmain_L1:
    pushq main.bottles(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jle .Lmain_L2
    pushq main.bottles(%rbp)
    popq %rdi
    call print_integer
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.bottles(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    call print_newline
    leaq text_2(%rip), %rdi
    call print_text
    pushq main.bottles(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rdi
    call print_integer
    leaq text_3(%rip), %rdi
    call print_text
    call print_newline
    pushq main.bottles(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.bottles(%rbp)
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
