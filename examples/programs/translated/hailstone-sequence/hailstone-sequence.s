# Hailstone sequence in x86-64 assembly (GNU as, AT&T): count the steps to reach 1

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz " takes "
text_1: .asciz " steps"

    .text
.type hailstone_steps, @function
hailstone_steps:
    .set hailstone_steps.number, -8
    .set hailstone_steps.steps, -16
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, hailstone_steps.number(%rbp)
    pushq $0
    popq %rax
    movq %rax, hailstone_steps.steps(%rbp)
.Lhailstone_steps_L1:
    pushq hailstone_steps.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    je .Lhailstone_steps_L2
    pushq hailstone_steps.number(%rbp)
    pushq $2
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
    jne .Lhailstone_steps_L3
    pushq hailstone_steps.number(%rbp)
    pushq $2
    popq %rcx
    popq %rax
    cqto
    idivq %rcx
    pushq %rax
    popq %rax
    movq %rax, hailstone_steps.number(%rbp)
    jmp .Lhailstone_steps_L4
.Lhailstone_steps_L3:
    pushq $3
    pushq hailstone_steps.number(%rbp)
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, hailstone_steps.number(%rbp)
.Lhailstone_steps_L4:
    pushq hailstone_steps.steps(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, hailstone_steps.steps(%rbp)
    jmp .Lhailstone_steps_L1
.Lhailstone_steps_L2:
    pushq hailstone_steps.steps(%rbp)
    popq %rax
    leave
    ret
.size hailstone_steps, .-hailstone_steps

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
    pushq $11
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.number(%rbp)
    popq %rdi
    call print_integer
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.number(%rbp)
    popq %rdi
    call hailstone_steps
    pushq %rax
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    call print_newline
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
