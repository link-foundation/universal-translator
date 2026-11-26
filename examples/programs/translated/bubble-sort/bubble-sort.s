# Bubble sort in x86-64 assembly (GNU as, AT&T): sort a list of numbers

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"

    .text
.type main, @function
main:
    .set main.numbers, -8
    .set main.count, -16
    .set main.pass, -24
    .set main.index, -32
    .set main.swap, -40
    .set main.position, -48
    pushq %rbp
    movq %rsp, %rbp
    subq $48, %rsp
    pushq $7
    pushq $0
    popq %rsi
    popq %rdi
    call new_array
    pushq %rax
    pushq (%rsp)
    pushq $0
    pushq $5
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $1
    pushq $3
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $2
    pushq $8
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $3
    pushq $1
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $4
    pushq $9
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $5
    pushq $2
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $6
    pushq $7
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    popq %rax
    movq %rax, main.numbers(%rbp)
    pushq main.numbers(%rbp)
    popq %rax
    pushq -8(%rax)
    popq %rax
    movq %rax, main.count(%rbp)
    pushq $0
    popq %rax
    movq %rax, main.pass(%rbp)
.Lmain_L1:
    pushq main.pass(%rbp)
    pushq main.count(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L2
    pushq $0
    popq %rax
    movq %rax, main.index(%rbp)
.Lmain_L3:
    pushq main.index(%rbp)
    pushq main.count(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    pushq main.pass(%rbp)
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L4
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jle .Lmain_L5
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rax
    movq %rax, main.swap(%rbp)
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq main.numbers(%rbp)
    pushq main.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    pushq main.swap(%rbp)
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    jmp .Lmain_L6
.Lmain_L5:
.Lmain_L6:
    pushq main.index(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.index(%rbp)
    jmp .Lmain_L3
.Lmain_L4:
    pushq main.pass(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.pass(%rbp)
    jmp .Lmain_L1
.Lmain_L2:
    pushq $0
    popq %rax
    movq %rax, main.position(%rbp)
.Lmain_L7:
    pushq main.position(%rbp)
    pushq main.count(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jge .Lmain_L8
    pushq main.numbers(%rbp)
    pushq main.position(%rbp)
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rdi
    call print_integer
    call print_newline
    pushq main.position(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    addq %rcx, %rax
    pushq %rax
    popq %rax
    movq %rax, main.position(%rbp)
    jmp .Lmain_L7
.Lmain_L8:
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
