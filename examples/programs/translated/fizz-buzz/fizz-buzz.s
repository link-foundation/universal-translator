# FizzBuzz in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "FizzBuzz"
text_1: .asciz "Fizz"
text_2: .asciz "Buzz"

    .text
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
    pushq $101
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.number(%rbp)
    pushq $15
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
    jne .Lmain_L3
    leaq text_0(%rip), %rdi
    call print_text
    call print_newline
    jmp .Lmain_L4
.Lmain_L3:
    pushq main.number(%rbp)
    pushq $3
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
    jne .Lmain_L5
    leaq text_1(%rip), %rdi
    call print_text
    call print_newline
    jmp .Lmain_L6
.Lmain_L5:
    pushq main.number(%rbp)
    pushq $5
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
    jne .Lmain_L7
    leaq text_2(%rip), %rdi
    call print_text
    call print_newline
    jmp .Lmain_L8
.Lmain_L7:
    pushq main.number(%rbp)
    popq %rdi
    call print_integer
    call print_newline
.Lmain_L8:
.Lmain_L6:
.Lmain_L4:
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
