# Towers of Hanoi in x86-64 assembly (GNU as, AT&T), solved recursively

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "Move disk "
text_1: .asciz " from "
text_2: .asciz " to "

    .text
.type move_disks, @function
move_disks:
    .set move_disks.count, -8
    .set move_disks.source, -16
    .set move_disks.target, -24
    .set move_disks.spare, -32
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    movq %rdi, move_disks.count(%rbp)
    movq %rsi, move_disks.source(%rbp)
    movq %rdx, move_disks.target(%rbp)
    movq %rcx, move_disks.spare(%rbp)
    pushq move_disks.count(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jne .Lmove_disks_L1
    leave
    ret
    jmp .Lmove_disks_L2
.Lmove_disks_L1:
.Lmove_disks_L2:
    pushq move_disks.count(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    pushq move_disks.source(%rbp)
    pushq move_disks.spare(%rbp)
    pushq move_disks.target(%rbp)
    popq %rcx
    popq %rdx
    popq %rsi
    popq %rdi
    call move_disks
    leaq text_0(%rip), %rdi
    call print_text
    pushq move_disks.count(%rbp)
    popq %rdi
    call print_integer
    leaq text_1(%rip), %rdi
    call print_text
    pushq move_disks.source(%rbp)
    popq %rdi
    call print_integer
    leaq text_2(%rip), %rdi
    call print_text
    pushq move_disks.target(%rbp)
    popq %rdi
    call print_integer
    call print_newline
    pushq move_disks.count(%rbp)
    pushq $1
    popq %rcx
    popq %rax
    subq %rcx, %rax
    pushq %rax
    pushq move_disks.spare(%rbp)
    pushq move_disks.target(%rbp)
    pushq move_disks.source(%rbp)
    popq %rcx
    popq %rdx
    popq %rsi
    popq %rdi
    call move_disks
    leave
    ret
.size move_disks, .-move_disks

.type main, @function
main:
    pushq %rbp
    movq %rsp, %rbp
    pushq $4
    pushq $1
    pushq $3
    pushq $2
    popq %rcx
    popq %rdx
    popq %rsi
    popq %rdi
    call move_disks
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
