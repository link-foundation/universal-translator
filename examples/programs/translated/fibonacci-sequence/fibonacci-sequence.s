# Fibonacci sequence in x86-64 assembly (GNU as, AT&T), computed iteratively

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "fibonacci("
text_1: .asciz ") = "

    .text
.type fibonacci, @function
fibonacci:
    .set fibonacci.count, -8
    .set fibonacci.previous, -16
    .set fibonacci.current, -24
    .set fibonacci.step, -32
    .set fibonacci.next, -40
    pushq %rbp
    movq %rsp, %rbp
    subq $48, %rsp
    movq %rdi, fibonacci.count(%rbp)
    pushq $0
    popq %rax
    movq %rax, fibonacci.previous(%rbp)
    pushq $1
    popq %rax
    movq %rax, fibonacci.current(%rbp)
    pushq $0
    popq %rax
    movq %rax, fibonacci.step(%rbp)
.Lfibonacci_L1:
    pushq fibonacci.step(%rbp)
    pushq fibonacci.count(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lfibonacci_L2
    pushq fibonacci.previous(%rbp)
    pushq fibonacci.current(%rbp)
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, fibonacci.next(%rbp)
    pushq fibonacci.current(%rbp)
    popq %rax
    movq %rax, fibonacci.previous(%rbp)
    pushq fibonacci.next(%rbp)
    popq %rax
    movq %rax, fibonacci.current(%rbp)
    pushq fibonacci.step(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, fibonacci.step(%rbp)
    jmp .Lfibonacci_L1
.Lfibonacci_L2:
    pushq fibonacci.previous(%rbp)
    popq %rax
    leave
    ret
.size fibonacci, .-fibonacci

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
    pushq $21
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.index(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    pushq main.index(%rbp)
    popq %rdi
    call fibonacci
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
