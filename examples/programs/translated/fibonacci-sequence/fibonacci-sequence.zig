// Fibonacci sequence in Zig, computed iteratively

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn fibonacci(count: i64) i64 {
    var previous: i64 = 0;
    var current: i64 = 1;
    var step: i64 = 0;
    while (step < count) : (step += 1) {
        const next: i64 = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var index: i64 = 0;
    while (index <= 20) : (index += 1) {
        out.print("fibonacci({d}) = {d}\n", .{ index, fibonacci(index) }) catch {};
    }
}
