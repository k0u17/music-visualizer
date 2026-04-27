use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::quote;
use syn::{
    Block, GenericArgument, Ident, ImplItem, Item,
    PathArguments, ReturnType, Signature, Type,
    parse::Parse, parse::ParseStream, parse_macro_input,
};

enum Strategy {
    Debug,
    Display,
}

impl Parse for Strategy {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let ident = input.parse::<Ident>()?;
        match ident.to_string().as_str() {
            "debug" => Ok(Strategy::Debug),
            "display" => Ok(Strategy::Display),
            other => Err(syn::Error::new(ident.span(), format!(
                "unknown strategy `{other}`, expected `debug` or `display`"
            ))),
        }
    }
}

/// Rewrites a function (or methods within an impl block) returning `Result<T, E>`
/// to return `Result<T, JsError>`, mapping the error using the specified strategy:
///
/// - `#[js_error(debug)]`   — converts via `Debug` formatting (`E: Debug`)
/// - `#[js_error(display)]` — converts via `Display` formatting (`E: Display`), recommended when `E: Error`
///
/// When used on an impl block (typically placed before `#[wasm_bindgen]` so it
/// runs first), it finds all methods annotated with an inner `#[js_error(...)]`
/// attribute, transforms those methods, and removes the inner attribute:
///
/// ```ignore
/// #[js_error]
/// #[wasm_bindgen]
/// impl Foo {
///     #[js_error(into)]
///     pub async fn create() -> Result<Self, Box<dyn Error>> { ... }
/// }
/// ```
///
/// For sync functions, the body is moved into a closure; for async functions,
/// into an `async move` block. Either way, `?` operators continue to work
/// against the original error type.
#[proc_macro_attribute]
pub fn js_error(args: TokenStream, input: TokenStream) -> TokenStream {
    match parse_macro_input!(input as Item) {
        Item::Impl(mut impl_block) => {
            if !args.is_empty() {
                return syn::Error::new(Span::call_site(),
                    "#[js_error] on an impl block takes no arguments; \
                     put the strategy on each method instead"
                ).into_compile_error().into();
            }
            for item in &mut impl_block.items {
                let ImplItem::Fn(method) = item else { continue };
                let Some(pos) = method.attrs.iter()
                    .position(|a| a.path().is_ident("js_error"))
                else { continue };
                let attr = method.attrs.remove(pos);
                let strategy = match attr.parse_args::<Strategy>() {
                    Ok(s) => s,
                    Err(e) => return e.into_compile_error().into(),
                };
                if let Err(e) = transform(&strategy, &mut method.sig, &mut method.block) {
                    return e.into_compile_error().into();
                }
            }
            quote!(#impl_block).into()
        }
        Item::Fn(mut func) => {
            if args.is_empty() {
                return syn::Error::new(Span::call_site(),
                    "#[js_error] requires a strategy argument: \
                     `#[js_error(debug)]` or `#[js_error(display)]`"
                ).into_compile_error().into();
            }
            let strategy = parse_macro_input!(args as Strategy);
            if let Err(e) = transform(&strategy, &mut func.sig, &mut func.block) {
                return e.into_compile_error().into();
            }
            quote!(#func).into()
        }
        _ => syn::Error::new(Span::call_site(),
            "#[js_error] can only be applied to a function or impl block"
        ).into_compile_error().into(),
    }
}


fn transform(strategy: &Strategy, sig: &mut Signature, block: &mut Block) -> syn::Result<()> {
    let (ty, ok_ty) = extract_result_types(&sig.output)
        .map(|(original, ok)| (original.clone(), ok.clone()))?;

    let convert = match strategy {
        Strategy::Debug => quote! {
            |e| ::wasm_bindgen::JsError::new(&::std::format!("{:?}", e))
        },
        Strategy::Display => quote! {
            |e| ::wasm_bindgen::JsError::new(&::std::format!("{}", e))
        },
    };

    let original_block = block.clone();

    sig.output = syn::parse_quote! {
        -> ::std::result::Result<#ok_ty, ::wasm_bindgen::JsError>
    };
    *block = if sig.asyncness.is_some() {
        syn::parse_quote! {{
            (async || -> #ty #original_block)().await.map_err(#convert)
        }}
    } else {
        syn::parse_quote! {{
            (|| -> #ty #original_block)().map_err(#convert)
        }}
    };

    Ok(())
}

fn extract_result_types(ret: &ReturnType) -> syn::Result<(&Type, &Type)> {
    let ty = match ret {
        ReturnType::Type(_, ty) => ty.as_ref(),
        ReturnType::Default => return Err(syn::Error::new(
            Span::call_site(), "expected return type `Result<T, E>`, found `()`"
        )),
    };
    let err = || syn::Error::new_spanned(ty, format!("expected `Result<T, E>`, found `{}`", quote!(#ty)));
    let args = match ty {
        Type::Path(p) => {
            let seg = p.path.segments.last().ok_or_else(err)?;
            if seg.ident != "Result" {
                return Err(err());
            }
            match &seg.arguments {
                PathArguments::AngleBracketed(a) => &a.args,
                _ => return Err(err()),
            }
        }
        _ => return Err(err()),
    };
    if args.len() != 2 || args.iter().any(|a| !matches!(a, &GenericArgument::Type(_))) {
        return Err(err());
    }
    let Some(&GenericArgument::Type(ref ok_ty)) = args.first() else { unreachable!() };
    Ok((ty, ok_ty))
}