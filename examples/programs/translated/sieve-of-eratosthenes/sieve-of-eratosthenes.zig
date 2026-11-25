// Sieve of Eratosthenes in Zig: the primes up to 100

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const limit: i64 = 100;
    const is_prime = std.heap.page_allocator.alloc(i64, @intCast(limit + 1)) catch unreachable;
    defer std.heap.page_allocator.free(is_prime);
    @memset(is_prime, 1);
    is_prime[0] = 0;
    is_prime[1] = 0;
    var number: i64 = 2;
    while (number <= limit) : (number += 1) {
        if (is_prime[@intCast(number)] == 1) {
            out.print("{d}\n", .{number}) catch {};
            var multiple: i64 = number * number;
            while (multiple <= limit) {
                is_prime[@intCast(multiple)] = 0;
                multiple += number;
            }
        }
    }
}
