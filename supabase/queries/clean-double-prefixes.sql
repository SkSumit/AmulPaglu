-- SQL query to clean up double nested store prefixes in product image URLs
update public.products
set image_url = replace(image_url, '/s/62fa94df8c13af2e242eba16/s/62fa94df8c13af2e242eba16/', '/s/62fa94df8c13af2e242eba16/')
where image_url like '%/s/62fa94df8c13af2e242eba16/s/62fa94df8c13af2e242eba16/%';
