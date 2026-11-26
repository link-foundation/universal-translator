# Ackermann function in x86-64 assembly (GNU as, AT&T), defined recursively

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "ackermann("
text_1: .asciz ", "
text_2: .asciz ") = "

    .text
.type ackermann, @function
ackermann:
    .set ackermann.first, -8
    .set ackermann.second, -16
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    movq %rdi, ackermann.first(%rbp)
    movq %rsi, ackermann.second(%rbp)
    pushq ackermann.first(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lackermann_L1
    pushq ackermann.second(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    leave
    ret
    jmp .Lackermann_L2
.Lackermann_L1:
.Lackermann_L2:
    pushq ackermann.second(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lackermann_L3
    pushq ackermann.first(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    pushq $1
    popq %rsi
    popq %rdi
    call ackermann
    pushq %rax
    popq %rax
    leave
    ret
    jmp .Lackermann_L4
.Lackermann_L3:
.Lackermann_L4:
    pushq ackermann.first(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    pushq ackermann.first(%rbp)
    pushq ackermann.second(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rsi
    popq %rdi
    call ackermann
    pushq %rax
    popq %rsi
    popq %rdi
    call ackermann
    pushq %rax
    popq %rax
    leave
    ret
.size ackermann, .-ackermann

.type main, @function
main:
    .set main.first, -8
    .set main.second, -16
    pushq %rbp
    movq %rsp, %rbp
    subq $16, %rsp
    pushq $0
    popq %rax
    movq %rax, main.first(%rbp)
.Lmain_L1:
    pushq main.first(%rbp)
    pushq $4
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq $0
    popq %rax
    movq %rax, main.second(%rbp)
.Lmain_L3:
    pushq main.second(%rbp)
    pushq $5
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L4
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.first(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    pushq main.second(%rbp)
    popq %rdi
    call print_integer
    leaq text_2(%rip), %rdi
    call print_text
    pushq main.first(%rbp)
    pushq main.second(%rbp)
    popq %rsi
    popq %rdi
    call ackermann
    pushq %rax
    popq %rdi
    call print_integer
    call print_newline
    pushq main.second(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.second(%rbp)
    jmp .Lmain_L3
.Lmain_L4:
    pushq main.first(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.first(%rbp)
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
