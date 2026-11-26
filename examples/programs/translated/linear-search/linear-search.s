# Linear search in x86-64 assembly (GNU as, AT&T): find the position of a value in a list

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "Found "
text_1: .asciz " at position "

    .text
.type main, @function
main:
    .set main.numbers, -8
    .set main.wanted, -16
    .set main.position, -24
    .set main.current, -32
    .set main.index, -40
    .set main.number, -48
    pushq %rbp
    movq %rsp, %rbp
    subq $48, %rsp
    pushq $8
    pushq $0
    popq %rsi
    popq %rdi
    call new_array
    pushq %rax
    pushq (%rsp)
    pushq $0
    pushq $31
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $1
    pushq $41
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $2
    pushq $59
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $3
    pushq $26
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $4
    pushq $53
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $5
    pushq $58
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $6
    pushq $97
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $7
    pushq $93
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    popq %rax
    movq %rax, main.numbers(%rbp)
    pushq $53
    popq %rax
    movq %rax, main.wanted(%rbp)
    pushq $-1
    popq %rax
    movq %rax, main.position(%rbp)
    pushq $0
    popq %rax
    movq %rax, main.current(%rbp)
    pushq $0
    popq %rax
    movq %rax, main.index(%rbp)
.Lmain_L1:
    pushq main.index(%rbp)
    pushq main.numbers(%rbp)
    popq %rax
    pushq -8(%rax)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rax
    movq %rax, main.number(%rbp)
    pushq main.number(%rbp)
    pushq main.wanted(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lmain_L3
    pushq main.position(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L3
    pushq main.current(%rbp)
    popq %rax
    movq %rax, main.position(%rbp)
    jmp .Lmain_L4
.Lmain_L3:
.Lmain_L4:
    pushq main.current(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.current(%rbp)
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
    leaq text_0(%rip), %rdi
    call print_text
    pushq main.wanted(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    pushq main.position(%rbp)
    popq %rdi
    call print_integer
    call print_newline
    xorl %eax, %eax
    leave
    ret
.size main, .-main

new_array:
    pushq %rbp
    movq %rsp, %rbp
    andq $-16, %rsp
    pushq %rdi
    pushq %rsi
    leaq 8(,%rdi,8), %rdi
    call malloc@PLT
    popq %rsi
    popq %rdi
    movq %rdi, (%rax)
    addq $8, %rax
    xorl %ecx, %ecx
.Lnew_array_fill:
    cmpq %rdi, %rcx
    jge .Lnew_array_done
    movq %rsi, (%rax,%rcx,8)
    incq %rcx
    jmp .Lnew_array_fill
.Lnew_array_done:
    leave
    ret

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
