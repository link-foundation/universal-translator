# Factorial in x86-64 assembly (GNU as, AT&T), defined recursively

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "! = "

    .text
.type factorial, @function
factorial:
    .set factorial.number, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, factorial.number(%rbp)
    pushq factorial.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jg .Lfactorial_L1
    pushq $1
    popq %rax
    leave
    ret
    jmp .Lfactorial_L2
.Lfactorial_L1:
.Lfactorial_L2:
    pushq factorial.number(%rbp)
    pushq factorial.number(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rdi
    call factorial
    pushq %rax
    popq %rcx
    popq %rax
    imulq %rcx, %rax
    pushq %rax
    popq %rax
    leave
    ret
.size factorial, .-factorial

.type main, @function
main:
    .set main.number, -8
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $0
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
    call factorial
    pushq %rax
    popq %rdi
    call print_integer
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
