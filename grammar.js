const C = require('tree-sitter-c/grammar');
const HLSL = require("tree-sitter-hlsl/grammar")

const PREC = Object.assign(C.PREC, {
    IS: C.PREC.RELATIONAL + 1,
    AS: C.PREC.RELATIONAL + 1,
});

module.exports = grammar(HLSL, {
    name: 'slang',

    conflicts: ($, original) => original.concat([
        [$._declarator, $.type_hinted_declarator],
        //[$._scope_resolution]
    ]),

    rules: {
        _top_level_item: (_, original) => original,
        _top_level_statement: ($, original) => choice(original, $.import_statement),

        placeholder_type_specifier: $ => prec(1, seq(
            field('constraint', optional($._type_specifier)),
            choice("var", "let", "This"),
        )),

        init_declarator: $ => seq(
            field('declarator', choice($._declarator, $.type_hinted_declarator)),
            '=',
            field('value', choice($.initializer_list, $._expression)),
        ),

        declaration: $ => seq(
            $._declaration_specifiers,
            commaSep1(field('declarator', choice(
                // type hint has ambiguity with semantics in struct declarations
                seq(choice($._declarator, $.type_hinted_declarator), optional(alias(seq(':', $._expression), $.semantics))),
                $.init_declarator
            ))),
            ';'
        ),

        type_hinted_declarator: $ => seq($.identifier, $.type_hint),
        type_hint: $ => seq(":", $._type_declarator),

        interface_specifier: $ => seq(
            'interface',
            $._class_declaration,
        ),

        extension_specifier: $ => seq(
            'extension',
            $._class_declaration,
        ),

        _type_specifier: ($, original) => choice(original, $.interface_specifier, $.extension_specifier),

        template_argument_list: $ => seq(
            '<',
            commaSep(choice(
                prec.dynamic(4, seq($.type_descriptor, $.interface_requirements)),
                prec.dynamic(3, $.type_descriptor),
                prec.dynamic(2, alias($.type_parameter_pack_expansion, $.parameter_pack_expansion)),
                prec.dynamic(1, $._expression),
            )),
            alias(token(prec(1, '>')), '>'),
        ),
        interface_requirements: $ => prec.left(seq(":", commaSep1($.identifier))),

        binary_expression: ($, original) => {
            const table = [
                ['is', PREC.IS],
                ['as', PREC.AS],
            ];

            return choice(
                ...original.members,
                ...table.map(([operator, precedence]) => {
                    return prec.left(precedence, seq(
                        field('left', $._expression),
                        // @ts-ignore
                        field('operator', operator),
                        field('right', $._expression),
                    ));
                }));
        },

        import_statement: $ => seq(optional("__exported"), "import", dotSep1($.identifier), ";"),

        // TODO: fix type_hinted_declarator
        _field_declaration_list_item: ($, original) => choice(original, $.property_declaration, $.subscript_declaration, $.init_declaration),
        init_declaration: $ => seq("__init", $.parameter_list, $.compound_statement),
        subscript_declaration: $ => seq("__subscript", $.parameter_list, optional($.trailing_return_type), alias(seq("{", repeat(choice($.property_get, $.property_set)), "}"), $.compound_statement)),
        property_declaration: $ => seq("property",
            choice(seq($.identifier, ":", $.type_descriptor),
                seq($.type_descriptor, $.identifier)),
            alias(seq("{", repeat(choice($.property_get, $.property_set)), "}"), $.compound_statement)),
        property_get: $ => seq("get", choice($.compound_statement, ";")),
        property_set: $ => seq("set", choice($.compound_statement, ";")),
    },

    //_empty_declaration: $ => seq(
      //$._type_specifier,
      //optional(';'),
    //),
    //declaration: $ => seq(
      //$._declaration_specifiers,
      //$._declaration_declarator,
      //optional(';'),
    //),
});

function commaSep(rule) {
    return optional(commaSep1(rule));
}

function commaSep1(rule) {
    return seq(rule, repeat(seq(',', rule)))
}

function dotSep1(rule) {
    return seq(rule, repeat(seq('.', rule)))
}
