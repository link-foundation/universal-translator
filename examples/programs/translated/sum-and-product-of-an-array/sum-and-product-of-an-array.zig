// Sum and product of an array in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const numbers: [5]i64 = .{ 1, 2, 3, 4, 5 };
    var total: i64 = 0;
    var product: i64 = 1;
    var index: i64 = 0;
    while (index < @as(i64, @intCast(numbers.len))) : (index += 1) {
        total += numbers[@intCast(index)];
        product *= numbers[@intCast(index)];
    }
    out.print("Sum: {d}\n", .{total}) catch {};
    out.print("Product: {d}\n", .{product}) catch {};
}
