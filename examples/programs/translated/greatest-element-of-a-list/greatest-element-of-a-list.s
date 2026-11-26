# Greatest element of a list in x86-64 assembly (GNU as, AT&T)

    .globl main
    .section .rodata
integer_format: .asciz "%lld"
text_format: .asciz "%s"
newline_format: .asciz "\n"
text_0: .asciz "The greatest element is "

    .text
.type main, @function
main:
    .set main.numbers, -8
    .set main.greatest, -16
    .set main.index, -24
    .set main.number, -32
    pushq %rbp
    movq %rsp, %rbp
    subq $32, %rsp
    pushq $7
    pushq $0
    popq %rsi
    popq %rdi
    call new_array
    pushq %rax
    pushq (%rsp)
    pushq $0
    pushq $17
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $1
    pushq $4
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $2
    pushq $93
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $3
    pushq $28
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $4
    pushq $65
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $5
    pushq $3
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    pushq (%rsp)
    pushq $6
    pushq $80
    popq %rdx
    popq %rcx
    popq %rax
    movq %rdx, (%rax,%rcx,8)
    popq %rax
    movq %rax, main.numbers(%rbp)
    pushq main.numbers(%rbp)
    pushq $0
    popq %rcx
    popq %rax
    pushq (%rax,%rcx,8)
    popq %rax
    movq %rax, main.greatest(%rbp)
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
    pushq main.greatest(%rbp)
    popq %rcx
    popq %rax
    cmpq %rcx, %rax
    jle .Lmain_L3
    pushq main.number(%rbp)
    popq %rax
    movq %rax, main.greatest(%rbp)
    jmp .Lmain_L4
.Lmain_L3:
.Lmain_L4:
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
    pushq main.greatest(%rbp)
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
