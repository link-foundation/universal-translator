# Mutual recursion in x86-64 assembly (GNU as, AT&T): the Hofstadter Female and Male sequences

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz ": "
text_1: .asciz " "

    .text
.type female, @function
female:
    .set female.index, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, female.index(%rbp)
    pushq female.index(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lfemale_L1
    pushq $1
    popq %rax
    leave
    ret
    jmp .Lfemale_L2
.Lfemale_L1:
.Lfemale_L2:
    pushq female.index(%rbp)
    pushq female.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rdi
    call female
    pushq %rax
    popq %rdi
    call male
    pushq %rax
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rax
    leave
    ret
.size female, .-female

.type male, @function
male:
    .set male.index, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, male.index(%rbp)
    pushq male.index(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lmale_L1
    pushq $0
    popq %rax
    leave
    ret
    jmp .Lmale_L2
.Lmale_L1:
.Lmale_L2:
    pushq male.index(%rbp)
    pushq male.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rdi
    call male
    pushq %rax
    popq %rdi
    call female
    pushq %rax
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rax
    leave
    ret
.size male, .-male

.type main, @function
main:
    .set main.index, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $0
    popq %rax
    movq %rax, main.index(%rbp)
.Lmain_L1:
    pushq main.index(%rbp)
    pushq $20
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.index(%rbp)
    popq %rdi
    call print_integer
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.index(%rbp)
    popq %rdi
    call female
    pushq %rax
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    pushq main.index(%rbp)
    popq %rdi
    call male
    pushq %rax
    popq %rdi
    call print_integer
    call print_newline
    pushq main.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.index(%rbp)
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
