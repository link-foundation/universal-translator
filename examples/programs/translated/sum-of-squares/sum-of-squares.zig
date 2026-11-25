// Sum of squares in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn sumOfSquares(limit: i64) i64 {
    var total: i64 = 0;
    var number: i64 = 1;
    while (number <= limit) {
        total += number * number;
        number += 1;
    }
    return total;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const limit: i64 = 10;
    out.print("Sum of squares from 1 to {d}:\n", .{limit}) catch {};
    out.print("{d}\n", .{sumOfSquares(limit)}) catch {};
}
